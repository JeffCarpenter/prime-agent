"""Adaptive dual-tree complex-coordinate FMM in two dimensions.

The tree is built solely on real coordinates.  Complex box centers use the
paper's average-imaginary-part heuristic.  Unlike a real-distance-only test,
this implementation accepts M2L pairs only when both analytic characteristic
channels satisfy an explicit convergence inequality.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal

import numpy as np
from numpy.typing import ArrayLike, NDArray
from scipy.special import hankel1

from .coordinates import as_points, channels_2d, complex_radius
from .two_dimensional import (
    HelmholtzLocal,
    HelmholtzMultipole,
    LaplaceLocal,
    LaplaceMultipole,
    add_helmholtz_local,
    add_laplace_local,
    evaluate_helmholtz_local,
    evaluate_laplace_local,
    helmholtz_l2l,
    helmholtz_m2l,
    helmholtz_m2m,
    helmholtz_p2m,
    laplace_l2l,
    laplace_m2l,
    laplace_m2m,
    laplace_p2m,
    zero_helmholtz_local,
    zero_laplace_local,
)

ComplexArray = NDArray[np.complex128]
RealArray = NDArray[np.float64]
Expansion = LaplaceMultipole | HelmholtzMultipole
LocalExpansion = LaplaceLocal | HelmholtzLocal


@dataclass
class FMMStats:
    source_nodes: int = 0
    target_nodes: int = 0
    source_depth: int = 0
    target_depth: int = 0
    m2m_translations: int = 0
    m2l_translations: int = 0
    l2l_translations: int = 0
    direct_box_pairs: int = 0
    direct_particle_pairs: int = 0
    rejected_channel_pairs: int = 0


@dataclass
class FMMResult:
    values: ComplexArray
    stats: FMMStats


@dataclass(eq=False)
class _TreeNode:
    indices: NDArray[np.int64]
    lower: RealArray
    upper: RealArray
    depth: int
    center: ComplexArray
    radius_plus: float
    radius_minus: float
    children: list[_TreeNode] = field(default_factory=list)
    multipole: Expansion | None = None
    local: LocalExpansion | None = None

    @property
    def width(self) -> float:
        return float(self.upper[0] - self.lower[0])

    @property
    def leaf(self) -> bool:
        return not self.children


def _node_center(
    points: ComplexArray, indices: NDArray[np.int64], lower: RealArray, upper: RealArray
) -> ComplexArray:
    real_center = (lower + upper) / 2
    imaginary_center = np.mean(points[indices].imag, axis=0)
    return np.asarray(real_center + 1j * imaginary_center, dtype=np.complex128)


def _build_tree(
    points: ComplexArray,
    indices: NDArray[np.int64],
    lower: RealArray,
    upper: RealArray,
    depth: int,
    max_points: int,
    max_depth: int,
) -> _TreeNode:
    center = _node_center(points, indices, lower, upper)
    plus, minus = channels_2d(points[indices] - center)
    node = _TreeNode(
        indices,
        lower,
        upper,
        depth,
        center,
        float(np.max(np.abs(plus), initial=0.0)),
        float(np.max(np.abs(minus), initial=0.0)),
    )
    if len(indices) <= max_points or depth >= max_depth:
        return node
    real = points[indices].real
    # Equal real coordinates cannot be separated by the paper's real-part tree.
    # Stop rather than creating a unary chain to max_depth.
    if np.all(real == real[0]):
        return node
    midpoint = (lower + upper) / 2
    quadrant = (real[:, 0] >= midpoint[0]).astype(np.int8) + 2 * (real[:, 1] >= midpoint[1]).astype(
        np.int8
    )
    for code in range(4):
        child_indices = indices[quadrant == code]
        if not len(child_indices):
            continue
        child_lower = lower.copy()
        child_upper = upper.copy()
        if code & 1:
            child_lower[0] = midpoint[0]
        else:
            child_upper[0] = midpoint[0]
        if code & 2:
            child_lower[1] = midpoint[1]
        else:
            child_upper[1] = midpoint[1]
        node.children.append(
            _build_tree(
                points,
                child_indices,
                child_lower,
                child_upper,
                depth + 1,
                max_points,
                max_depth,
            )
        )
    return node


def _count_nodes(node: _TreeNode) -> tuple[int, int]:
    count = 1
    depth = node.depth
    for child in node.children:
        child_count, child_depth = _count_nodes(child)
        count += child_count
        depth = max(depth, child_depth)
    return count, depth


def _root_square(sources: ComplexArray, targets: ComplexArray) -> tuple[RealArray, RealArray]:
    combined = np.concatenate((sources.real, targets.real), axis=0)
    lower = np.min(combined, axis=0)
    upper = np.max(combined, axis=0)
    width = float(np.max(upper - lower))
    if width == 0:
        width = 1.0
    midpoint = (lower + upper) / 2
    padding = max(width * 1e-12, np.finfo(float).eps * max(1.0, float(np.max(np.abs(midpoint)))))
    half = width / 2 + padding
    return np.asarray(midpoint - half), np.asarray(midpoint + half)


def _form_multipoles(
    node: _TreeNode,
    sources: ComplexArray,
    strengths: ComplexArray,
    order: int,
    kernel: Literal["laplace", "helmholtz"],
    wavenumber: float | None,
    stats: FMMStats,
) -> Expansion:
    if node.leaf:
        if kernel == "laplace":
            node.multipole = laplace_p2m(
                sources[node.indices], strengths[node.indices], node.center, order
            )
        else:
            node.multipole = helmholtz_p2m(
                sources[node.indices],
                strengths[node.indices],
                node.center,
                order,
                float(wavenumber),
            )
        return node.multipole

    child_expansions = [
        _form_multipoles(child, sources, strengths, order, kernel, wavenumber, stats)
        for child in node.children
    ]
    if kernel == "laplace":
        combined = LaplaceMultipole(0.0j, np.zeros(order, complex), np.zeros(order, complex))
        for child, expansion in zip(node.children, child_expansions, strict=True):
            if not isinstance(expansion, LaplaceMultipole):
                raise TypeError("internal expansion type mismatch")
            shifted = laplace_m2m(expansion, child.center, node.center)
            combined.monopole += shifted.monopole
            combined.plus += shifted.plus
            combined.minus += shifted.minus
            stats.m2m_translations += 1
        node.multipole = combined
    else:
        coefficients = np.zeros(2 * order + 1, complex)
        for child, expansion in zip(node.children, child_expansions, strict=True):
            if not isinstance(expansion, HelmholtzMultipole):
                raise TypeError("internal expansion type mismatch")
            shifted = helmholtz_m2m(expansion, child.center, node.center, float(wavenumber))
            coefficients += shifted.coefficients
            stats.m2m_translations += 1
        node.multipole = HelmholtzMultipole(coefficients)
    return node.multipole


def _initialize_locals(
    node: _TreeNode, order: int, kernel: Literal["laplace", "helmholtz"]
) -> None:
    node.local = zero_laplace_local(order) if kernel == "laplace" else zero_helmholtz_local(order)
    for child in node.children:
        _initialize_locals(child, order, kernel)


def _admissible(target: _TreeNode, source: _TreeNode, safety: float) -> bool:
    displacement_plus, displacement_minus = channels_2d(source.center - target.center)
    plus_extent = source.radius_plus + target.radius_plus
    minus_extent = source.radius_minus + target.radius_minus
    return bool(
        safety * plus_extent < abs(displacement_plus)
        and safety * minus_extent < abs(displacement_minus)
    )


def _add_m2l(
    target: _TreeNode,
    source: _TreeNode,
    kernel: Literal["laplace", "helmholtz"],
    wavenumber: float | None,
) -> None:
    if kernel == "laplace":
        if not isinstance(source.multipole, LaplaceMultipole) or not isinstance(
            target.local, LaplaceLocal
        ):
            raise TypeError("internal Laplace expansion type mismatch")
        add_laplace_local(target.local, laplace_m2l(source.multipole, source.center, target.center))
    else:
        if not isinstance(source.multipole, HelmholtzMultipole) or not isinstance(
            target.local, HelmholtzLocal
        ):
            raise TypeError("internal Helmholtz expansion type mismatch")
        add_helmholtz_local(
            target.local,
            helmholtz_m2l(source.multipole, source.center, target.center, float(wavenumber)),
        )


def _dual_traverse(
    target: _TreeNode,
    source: _TreeNode,
    kernel: Literal["laplace", "helmholtz"],
    wavenumber: float | None,
    safety: float,
    direct_pairs: list[tuple[_TreeNode, _TreeNode]],
    stats: FMMStats,
) -> None:
    if _admissible(target, source, safety):
        _add_m2l(target, source, kernel, wavenumber)
        stats.m2l_translations += 1
        return

    stats.rejected_channel_pairs += 1
    if target.leaf and source.leaf:
        direct_pairs.append((target, source))
        stats.direct_box_pairs += 1
        return
    if source.leaf:
        for child in target.children:
            _dual_traverse(child, source, kernel, wavenumber, safety, direct_pairs, stats)
    elif target.leaf:
        for child in source.children:
            _dual_traverse(target, child, kernel, wavenumber, safety, direct_pairs, stats)
    elif target.width >= source.width:
        for child in target.children:
            _dual_traverse(child, source, kernel, wavenumber, safety, direct_pairs, stats)
    else:
        for child in source.children:
            _dual_traverse(target, child, kernel, wavenumber, safety, direct_pairs, stats)


def _propagate_locals(
    node: _TreeNode,
    kernel: Literal["laplace", "helmholtz"],
    wavenumber: float | None,
    stats: FMMStats,
) -> None:
    for child in node.children:
        if kernel == "laplace":
            if not isinstance(node.local, LaplaceLocal) or not isinstance(
                child.local, LaplaceLocal
            ):
                raise TypeError("internal Laplace local type mismatch")
            add_laplace_local(child.local, laplace_l2l(node.local, node.center, child.center))
        else:
            if not isinstance(node.local, HelmholtzLocal) or not isinstance(
                child.local, HelmholtzLocal
            ):
                raise TypeError("internal Helmholtz local type mismatch")
            add_helmholtz_local(
                child.local,
                helmholtz_l2l(node.local, node.center, child.center, float(wavenumber)),
            )
        stats.l2l_translations += 1
        _propagate_locals(child, kernel, wavenumber, stats)


def _evaluate_leaf_locals(
    node: _TreeNode,
    targets: ComplexArray,
    result: ComplexArray,
    kernel: Literal["laplace", "helmholtz"],
    wavenumber: float | None,
) -> None:
    if node.leaf:
        if kernel == "laplace":
            if not isinstance(node.local, LaplaceLocal):
                raise TypeError("internal Laplace local type mismatch")
            result[node.indices] += evaluate_laplace_local(
                node.local, targets[node.indices], node.center
            )
        else:
            if not isinstance(node.local, HelmholtzLocal):
                raise TypeError("internal Helmholtz local type mismatch")
            result[node.indices] += evaluate_helmholtz_local(
                node.local, targets[node.indices], node.center, float(wavenumber)
            )
        return
    for child in node.children:
        _evaluate_leaf_locals(child, targets, result, kernel, wavenumber)


def _evaluate_direct_pairs(
    pairs: list[tuple[_TreeNode, _TreeNode]],
    targets: ComplexArray,
    sources: ComplexArray,
    strengths: ComplexArray,
    result: ComplexArray,
    kernel: Literal["laplace", "helmholtz"],
    wavenumber: float | None,
    exclude_self: bool,
    stats: FMMStats,
) -> None:
    for target_node, source_node in pairs:
        for target_index in target_node.indices:
            difference = targets[target_index] - sources[source_node.indices]
            radius = complex_radius(difference)
            mask = (
                source_node.indices == target_index
                if exclude_self
                else np.zeros(len(source_node.indices), dtype=bool)
            )
            safe_radius = np.where(mask, 1.0 + 0.0j, radius)
            if kernel == "laplace":
                values = np.log(safe_radius)
            else:
                values = hankel1(0, float(wavenumber) * safe_radius)
            values[mask] = 0
            if exclude_self:
                stats.direct_particle_pairs += int(
                    len(source_node.indices) - np.count_nonzero(mask)
                )
            else:
                stats.direct_particle_pairs += len(source_node.indices)
            result[target_index] += values @ strengths[source_node.indices]


def evaluate_fmm_2d(
    targets: ArrayLike,
    sources: ArrayLike,
    strengths: ArrayLike,
    *,
    kernel: Literal["laplace", "helmholtz"] = "laplace",
    wavenumber: float | None = None,
    order: int = 14,
    max_points: int = 32,
    max_depth: int = 30,
    separation_safety: float = 2.0,
    exclude_self: bool = False,
) -> FMMResult:
    """Evaluate a two-dimensional complex-coordinate FMM sum.

    ``exclude_self`` is defined only when source and target arrays are exactly
    equal and removes pairs with identical global indices.  The returned
    kernels use the paper's unnormalized conventions.
    """
    target_points = as_points(targets, 2)
    source_points = as_points(sources, 2)
    charges = np.asarray(strengths, dtype=np.complex128)
    if not len(target_points) or not len(source_points):
        raise ValueError("source and target arrays must be nonempty")
    if charges.shape != (len(source_points),) or not np.all(np.isfinite(charges)):
        raise ValueError(f"strengths must be finite with shape ({len(source_points)},)")
    if kernel not in ("laplace", "helmholtz"):
        raise ValueError(f"unsupported kernel: {kernel}")
    if kernel == "helmholtz" and (
        wavenumber is None or not np.isfinite(wavenumber) or wavenumber <= 0
    ):
        raise ValueError("a positive finite wavenumber is required for Helmholtz")
    if (
        order < 1
        or max_points < 1
        or max_depth < 1
        or max_depth > 512
        or not np.isfinite(separation_safety)
        or separation_safety < 1
    ):
        raise ValueError(
            "require order/max_points >= 1, 1 <= max_depth <= 512, and finite "
            "separation_safety >= 1"
        )
    if exclude_self and (
        target_points.shape != source_points.shape
        or not np.array_equal(target_points, source_points)
    ):
        raise ValueError("exclude_self requires exactly equal source and target arrays")

    lower, upper = _root_square(source_points, target_points)
    source_root = _build_tree(
        source_points,
        np.arange(len(source_points), dtype=np.int64),
        lower,
        upper,
        0,
        max_points,
        max_depth,
    )
    target_root = _build_tree(
        target_points,
        np.arange(len(target_points), dtype=np.int64),
        lower,
        upper,
        0,
        max_points,
        max_depth,
    )
    stats = FMMStats()
    stats.source_nodes, stats.source_depth = _count_nodes(source_root)
    stats.target_nodes, stats.target_depth = _count_nodes(target_root)
    _form_multipoles(source_root, source_points, charges, order, kernel, wavenumber, stats)
    _initialize_locals(target_root, order, kernel)
    direct_pairs: list[tuple[_TreeNode, _TreeNode]] = []
    _dual_traverse(
        target_root,
        source_root,
        kernel,
        wavenumber,
        separation_safety,
        direct_pairs,
        stats,
    )
    _propagate_locals(target_root, kernel, wavenumber, stats)
    result = np.zeros(len(target_points), dtype=np.complex128)
    _evaluate_leaf_locals(target_root, target_points, result, kernel, wavenumber)
    _evaluate_direct_pairs(
        direct_pairs,
        target_points,
        source_points,
        charges,
        result,
        kernel,
        wavenumber,
        exclude_self,
        stats,
    )
    return FMMResult(result, stats)
