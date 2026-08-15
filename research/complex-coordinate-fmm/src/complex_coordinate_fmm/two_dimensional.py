"""Two-dimensional complex-coordinate Laplace and Helmholtz expansions."""

from __future__ import annotations

from dataclasses import dataclass
from math import comb
from typing import Literal

import numpy as np
from numpy.typing import ArrayLike, NDArray
from scipy.special import hankel1, jv

from .coordinates import as_points, channels_2d, complex_radius, polar_factors

ComplexArray = NDArray[np.complex128]


@dataclass
class LaplaceMultipole:
    """Coefficients through ``order`` for the paper's unnormalized ``log(r)`` kernel."""

    monopole: complex
    plus: ComplexArray
    minus: ComplexArray

    @property
    def order(self) -> int:
        return len(self.plus)

    def copy(self) -> LaplaceMultipole:
        return LaplaceMultipole(self.monopole, self.plus.copy(), self.minus.copy())


@dataclass
class LaplaceLocal:
    constant: complex
    plus: ComplexArray
    minus: ComplexArray

    @property
    def order(self) -> int:
        return len(self.plus)

    def copy(self) -> LaplaceLocal:
        return LaplaceLocal(self.constant, self.plus.copy(), self.minus.copy())


@dataclass
class HelmholtzMultipole:
    """Coefficients indexed by the integer orders ``-order,...,order``."""

    coefficients: ComplexArray

    @property
    def order(self) -> int:
        return (len(self.coefficients) - 1) // 2

    def copy(self) -> HelmholtzMultipole:
        return HelmholtzMultipole(self.coefficients.copy())


@dataclass
class HelmholtzLocal:
    coefficients: ComplexArray

    @property
    def order(self) -> int:
        return (len(self.coefficients) - 1) // 2

    def copy(self) -> HelmholtzLocal:
        return HelmholtzLocal(self.coefficients.copy())


def _strengths(strengths: ArrayLike, count: int) -> ComplexArray:
    value = np.asarray(strengths, dtype=np.complex128)
    if value.shape != (count,):
        raise ValueError(f"strengths must have shape ({count},)")
    if not np.all(np.isfinite(value)):
        raise ValueError("strengths must be finite")
    return value


def _center(center: ArrayLike) -> ComplexArray:
    value = np.asarray(center, dtype=np.complex128)
    if value.shape != (2,):
        raise ValueError("center must have shape (2,)")
    return value


def zero_laplace_local(order: int) -> LaplaceLocal:
    if order < 1:
        raise ValueError("order must be at least 1")
    return LaplaceLocal(0.0j, np.zeros(order, complex), np.zeros(order, complex))


def zero_helmholtz_local(order: int) -> HelmholtzLocal:
    if order < 0:
        raise ValueError("order must be nonnegative")
    return HelmholtzLocal(np.zeros(2 * order + 1, complex))


def add_laplace_local(destination: LaplaceLocal, contribution: LaplaceLocal) -> None:
    if destination.order != contribution.order:
        raise ValueError("orders must match")
    destination.constant += contribution.constant
    destination.plus += contribution.plus
    destination.minus += contribution.minus


def add_helmholtz_local(destination: HelmholtzLocal, contribution: HelmholtzLocal) -> None:
    if destination.order != contribution.order:
        raise ValueError("orders must match")
    destination.coefficients += contribution.coefficients


def _positive_wavenumber(wavenumber: float | None) -> float:
    if wavenumber is None or not np.isfinite(wavenumber) or wavenumber <= 0:
        raise ValueError("wavenumber must be positive and finite")
    return float(wavenumber)


def laplace_kernel_2d(target: ArrayLike, source: ArrayLike) -> complex:
    """Paper convention: ``log(sqrt(sum((target-source)**2)))``."""
    difference = np.asarray(target, complex) - np.asarray(source, complex)
    radius = complex_radius(difference)
    if radius == 0:
        return complex(-np.inf)
    return complex(np.log(radius))


def helmholtz_kernel_2d(target: ArrayLike, source: ArrayLike, wavenumber: float) -> complex:
    """Paper convention: unnormalized ``H_0^(1)(k*r)``."""
    kappa = _positive_wavenumber(wavenumber)
    radius = complex_radius(np.asarray(target, complex) - np.asarray(source, complex))
    return complex(hankel1(0, kappa * radius))


def direct_sum_2d(
    targets: ArrayLike,
    sources: ArrayLike,
    strengths: ArrayLike,
    *,
    kernel: Literal["laplace", "helmholtz"] = "laplace",
    wavenumber: float | None = None,
    exclude_pairs: set[tuple[int, int]] | None = None,
) -> ComplexArray:
    """Evaluate a direct two-dimensional N-body sum."""
    target_points = as_points(targets, 2)
    source_points = as_points(sources, 2)
    charges = _strengths(strengths, len(source_points))
    kappa = _positive_wavenumber(wavenumber) if kernel == "helmholtz" else None
    result = np.zeros(len(target_points), dtype=np.complex128)
    for target_index, target in enumerate(target_points):
        difference = target - source_points
        radius = complex_radius(difference)
        mask = np.array(
            [
                exclude_pairs is not None and (target_index, source_index) in exclude_pairs
                for source_index in range(len(source_points))
            ],
            dtype=bool,
        )
        safe_radius = np.where(mask, 1.0 + 0.0j, radius)
        if kernel == "laplace":
            values = np.log(safe_radius)
        elif kernel == "helmholtz":
            values = hankel1(0, float(kappa) * safe_radius)
        else:
            raise ValueError(f"unsupported kernel: {kernel}")
        values[mask] = 0
        result[target_index] = values @ charges
    return result


def laplace_p2m(
    sources: ArrayLike, strengths: ArrayLike, center: ArrayLike, order: int
) -> LaplaceMultipole:
    points = as_points(sources, 2)
    charges = _strengths(strengths, len(points))
    origin = _center(center)
    if order < 1:
        raise ValueError("order must be at least 1")
    plus_channel, minus_channel = channels_2d(points - origin)
    plus = np.empty(order, dtype=np.complex128)
    minus = np.empty(order, dtype=np.complex128)
    for n in range(1, order + 1):
        plus[n - 1] = -(minus_channel**n @ charges) / (2 * n)
        minus[n - 1] = -(plus_channel**n @ charges) / (2 * n)
    return LaplaceMultipole(complex(np.sum(charges)), plus, minus)


def laplace_m2m(
    expansion: LaplaceMultipole, old_center: ArrayLike, new_center: ArrayLike
) -> LaplaceMultipole:
    """Translate a multipole from ``old_center`` to ``new_center``."""
    offset_plus, offset_minus = channels_2d(_center(old_center) - _center(new_center))
    order = expansion.order
    translated = LaplaceMultipole(
        expansion.monopole, np.empty(order, complex), np.empty(order, complex)
    )
    for k in range(1, order + 1):
        translated.plus[k - 1] = -expansion.monopole * offset_minus**k / (2 * k)
        translated.minus[k - 1] = -expansion.monopole * offset_plus**k / (2 * k)
        for n in range(1, k + 1):
            factor = comb(k - 1, n - 1)
            translated.plus[k - 1] += factor * offset_minus ** (k - n) * expansion.plus[n - 1]
            translated.minus[k - 1] += factor * offset_plus ** (k - n) * expansion.minus[n - 1]
    return translated


def evaluate_laplace_multipole(
    expansion: LaplaceMultipole, targets: ArrayLike, center: ArrayLike
) -> ComplexArray:
    points = as_points(targets, 2)
    plus_channel, minus_channel = channels_2d(points - _center(center))
    radius = np.sqrt(plus_channel * minus_channel)
    if np.any(radius == 0) or np.any(plus_channel == 0) or np.any(minus_channel == 0):
        raise ValueError("multipole evaluation is singular on a characteristic channel")
    result = expansion.monopole * np.log(radius)
    for n in range(1, expansion.order + 1):
        result += expansion.plus[n - 1] / minus_channel**n
        result += expansion.minus[n - 1] / plus_channel**n
    return np.asarray(result, dtype=np.complex128)


def laplace_m2l(
    expansion: LaplaceMultipole, source_center: ArrayLike, target_center: ArrayLike
) -> LaplaceLocal:
    """Convert a multipole to a same-order local expansion.

    The displacement is source-center minus target-center.  Both characteristic
    channels must be nonzero; convergence is the caller's responsibility.
    """
    displacement = _center(source_center) - _center(target_center)
    plus_channel, minus_channel = channels_2d(displacement)
    if plus_channel == 0 or minus_channel == 0:
        raise ValueError("M2L displacement lies on a characteristic channel")
    radius = complex_radius(displacement)
    order = expansion.order
    constant = expansion.monopole * np.log(radius)
    for n in range(1, order + 1):
        sign = (-1) ** n
        constant += sign * expansion.plus[n - 1] / minus_channel**n
        constant += sign * expansion.minus[n - 1] / plus_channel**n
    local = LaplaceLocal(complex(constant), np.empty(order, complex), np.empty(order, complex))
    for k in range(1, order + 1):
        local.plus[k - 1] = -expansion.monopole / (2 * k * plus_channel**k)
        local.minus[k - 1] = -expansion.monopole / (2 * k * minus_channel**k)
        for n in range(1, order + 1):
            factor = (-1) ** n * comb(n + k - 1, k)
            local.plus[k - 1] += factor * expansion.minus[n - 1] / plus_channel ** (n + k)
            local.minus[k - 1] += factor * expansion.plus[n - 1] / minus_channel ** (n + k)
    return local


def laplace_p2l(
    sources: ArrayLike, strengths: ArrayLike, center: ArrayLike, order: int
) -> LaplaceLocal:
    points = as_points(sources, 2)
    charges = _strengths(strengths, len(points))
    plus_channel, minus_channel = channels_2d(points - _center(center))
    radius = np.sqrt(plus_channel * minus_channel)
    if np.any(radius == 0) or np.any(plus_channel == 0) or np.any(minus_channel == 0):
        raise ValueError("local source lies on a characteristic channel")
    local = LaplaceLocal(
        complex(np.log(radius) @ charges), np.empty(order, complex), np.empty(order, complex)
    )
    for n in range(1, order + 1):
        local.plus[n - 1] = -(charges / plus_channel**n).sum() / (2 * n)
        local.minus[n - 1] = -(charges / minus_channel**n).sum() / (2 * n)
    return local


def laplace_l2l(
    expansion: LaplaceLocal, parent_center: ArrayLike, child_center: ArrayLike
) -> LaplaceLocal:
    """Shift a local expansion from a parent center to a child center."""
    offset_plus, offset_minus = channels_2d(_center(child_center) - _center(parent_center))
    order = expansion.order
    translated = zero_laplace_local(order)
    translated.constant = expansion.constant
    for n in range(1, order + 1):
        translated.constant += expansion.plus[n - 1] * offset_plus**n
        translated.constant += expansion.minus[n - 1] * offset_minus**n
    for k in range(1, order + 1):
        for n in range(k, order + 1):
            factor = comb(n, k)
            translated.plus[k - 1] += factor * offset_plus ** (n - k) * expansion.plus[n - 1]
            translated.minus[k - 1] += factor * offset_minus ** (n - k) * expansion.minus[n - 1]
    return translated


def evaluate_laplace_local(
    expansion: LaplaceLocal, targets: ArrayLike, center: ArrayLike
) -> ComplexArray:
    points = as_points(targets, 2)
    plus_channel, minus_channel = channels_2d(points - _center(center))
    result = np.full(len(points), expansion.constant, dtype=np.complex128)
    for n in range(1, expansion.order + 1):
        result += expansion.plus[n - 1] * plus_channel**n
        result += expansion.minus[n - 1] * minus_channel**n
    return result


def _cylindrical_basis(order: int, argument: complex, phase: complex) -> complex:
    if argument == 0:
        return 1.0 + 0.0j if order == 0 else 0.0j
    return complex(jv(order, argument) * phase**order)


def helmholtz_p2m(
    sources: ArrayLike,
    strengths: ArrayLike,
    center: ArrayLike,
    order: int,
    wavenumber: float,
) -> HelmholtzMultipole:
    points = as_points(sources, 2)
    charges = _strengths(strengths, len(points))
    if order < 0:
        raise ValueError("order must be nonnegative")
    kappa = _positive_wavenumber(wavenumber)
    coefficients = np.zeros(2 * order + 1, dtype=np.complex128)
    for point, charge in zip(points, charges, strict=True):
        difference = point - _center(center)
        plus, minus = channels_2d(difference)
        radius = complex(np.sqrt(plus * minus))
        phase_minus = 1.0 + 0.0j if radius == 0 else complex(minus / radius)
        for n in range(-order, order + 1):
            coefficients[n + order] += charge * _cylindrical_basis(n, kappa * radius, phase_minus)
    return HelmholtzMultipole(coefficients)


def helmholtz_m2m(
    expansion: HelmholtzMultipole,
    old_center: ArrayLike,
    new_center: ArrayLike,
    wavenumber: float,
) -> HelmholtzMultipole:
    kappa = _positive_wavenumber(wavenumber)
    if np.array_equal(_center(old_center), _center(new_center)):
        return expansion.copy()
    factors = polar_factors(_center(old_center) - _center(new_center))
    order = expansion.order
    translated = np.zeros_like(expansion.coefficients)
    for m in range(-order, order + 1):
        for n in range(-order, order + 1):
            q = m - n
            translated[m + order] += (
                jv(q, kappa * factors.radius)
                * factors.phase_minus**q
                * expansion.coefficients[n + order]
            )
    return HelmholtzMultipole(translated)


def evaluate_helmholtz_multipole(
    expansion: HelmholtzMultipole,
    targets: ArrayLike,
    center: ArrayLike,
    wavenumber: float,
) -> ComplexArray:
    kappa = _positive_wavenumber(wavenumber)
    points = as_points(targets, 2)
    result = np.zeros(len(points), dtype=np.complex128)
    for index, point in enumerate(points):
        factors = polar_factors(point - _center(center))
        for n in range(-expansion.order, expansion.order + 1):
            result[index] += (
                expansion.coefficients[n + expansion.order]
                * hankel1(n, kappa * factors.radius)
                * factors.phase_plus**n
            )
    return result


def helmholtz_m2l(
    expansion: HelmholtzMultipole,
    source_center: ArrayLike,
    target_center: ArrayLike,
    wavenumber: float,
) -> HelmholtzLocal:
    kappa = _positive_wavenumber(wavenumber)
    factors = polar_factors(_center(source_center) - _center(target_center))
    order = expansion.order
    translated = np.zeros_like(expansion.coefficients)
    for m in range(-order, order + 1):
        for n in range(-order, order + 1):
            q = m - n
            translated[m + order] += (
                hankel1(q, kappa * factors.radius)
                * factors.phase_minus**q
                * expansion.coefficients[n + order]
            )
    return HelmholtzLocal(translated)


def helmholtz_p2l(
    sources: ArrayLike,
    strengths: ArrayLike,
    center: ArrayLike,
    order: int,
    wavenumber: float,
) -> HelmholtzLocal:
    if order < 0:
        raise ValueError("order must be nonnegative")
    kappa = _positive_wavenumber(wavenumber)
    points = as_points(sources, 2)
    charges = _strengths(strengths, len(points))
    coefficients = np.zeros(2 * order + 1, dtype=np.complex128)
    for point, charge in zip(points, charges, strict=True):
        factors = polar_factors(point - _center(center))
        for n in range(-order, order + 1):
            coefficients[n + order] += (
                charge * hankel1(n, kappa * factors.radius) * factors.phase_minus**n
            )
    return HelmholtzLocal(coefficients)


def helmholtz_l2l(
    expansion: HelmholtzLocal,
    parent_center: ArrayLike,
    child_center: ArrayLike,
    wavenumber: float,
) -> HelmholtzLocal:
    kappa = _positive_wavenumber(wavenumber)
    if np.array_equal(_center(parent_center), _center(child_center)):
        return expansion.copy()
    factors = polar_factors(_center(parent_center) - _center(child_center))
    order = expansion.order
    translated = np.zeros_like(expansion.coefficients)
    for m in range(-order, order + 1):
        for n in range(-order, order + 1):
            q = m - n
            translated[m + order] += (
                jv(q, kappa * factors.radius)
                * factors.phase_minus**q
                * expansion.coefficients[n + order]
            )
    return HelmholtzLocal(translated)


def evaluate_helmholtz_local(
    expansion: HelmholtzLocal,
    targets: ArrayLike,
    center: ArrayLike,
    wavenumber: float,
) -> ComplexArray:
    kappa = _positive_wavenumber(wavenumber)
    points = as_points(targets, 2)
    result = np.zeros(len(points), dtype=np.complex128)
    for index, point in enumerate(points):
        difference = point - _center(center)
        plus, _ = channels_2d(difference)
        radius = complex(complex_radius(difference))
        phase_plus = 1.0 + 0.0j if radius == 0 else complex(plus / radius)
        for n in range(-expansion.order, expansion.order + 1):
            result[index] += expansion.coefficients[n + expansion.order] * _cylindrical_basis(
                n, kappa * radius, phase_plus
            )
    return result


def laplace_2d_error_bound(
    charge_norm: float, lipschitz: float, near: float, far: float, order: int
) -> float:
    """Theorems 4.2/4.3 bound ``A/(c-1)*c**(-P)``."""
    if charge_norm < 0 or not 0 <= lipschitz < 1 or not 0 < near < far or order < 1:
        raise ValueError("invalid bound parameters")
    c = (1 - lipschitz) * far / ((1 + lipschitz) * near)
    if c <= 1:
        raise ValueError("the paper's sufficient separation condition is not met")
    return charge_norm / (c - 1) * c ** (-order)
