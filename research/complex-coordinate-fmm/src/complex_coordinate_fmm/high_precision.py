"""Arbitrary-precision direct oracles for branch and cancellation checks.

These routines are deliberately O(N*M). They preserve mpmath/string/object
inputs and return object arrays of ``mpmath.mpc`` values. They support
validation and the paper's recommendation to use variable precision when
Helmholtz translations suffer catastrophic cancellation; they are not a
replacement for the FMM.
"""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Literal

import mpmath as mp
import numpy as np
from numpy.typing import ArrayLike, NDArray

MPArray = NDArray[np.object_]


def _mpc(value: object) -> mp.mpc:
    """Convert without routing existing arbitrary-precision values through float."""
    if isinstance(value, mp.mpc):
        return mp.mpc(value)
    if isinstance(value, mp.mpf):
        return mp.mpc(value)
    if isinstance(value, np.generic):
        value = value.item()
    if isinstance(value, complex):
        return mp.mpc(repr(value.real), repr(value.imag))
    if isinstance(value, float):
        return mp.mpc(repr(value))
    return mp.mpc(value)


def _positive_wavenumber(value: object | None) -> mp.mpf:
    if value is None:
        raise ValueError("wavenumber must be positive and finite")
    converted = _mpc(value)
    if converted.imag != 0 or not mp.isfinite(converted.real) or converted.real <= 0:
        raise ValueError("wavenumber must be positive, finite, and real")
    return mp.mpf(converted.real)


@contextmanager
def _precision(decimal_digits: int) -> Iterator[None]:
    if decimal_digits < 15:
        raise ValueError("decimal_digits must be at least 15")
    with mp.workdps(decimal_digits):
        yield


def _object_points(points: ArrayLike, dimension: int, name: str) -> NDArray[np.object_]:
    values = np.asarray(points, dtype=object)
    if values.ndim != 2 or values.shape[1] != dimension:
        raise ValueError(f"{name} must have shape (N, {dimension})")
    return values


def _object_strengths(strengths: ArrayLike, count: int) -> NDArray[np.object_]:
    values = np.asarray(strengths, dtype=object)
    if values.shape != (count,):
        raise ValueError(f"strengths must have shape ({count},)")
    return values


def _ensure_finite(values: NDArray[np.object_], name: str) -> None:
    if any(not mp.isfinite(_mpc(value)) for value in values.flat):
        raise ValueError(f"{name} must be finite")


def complex_radius_mp(vector: ArrayLike, *, decimal_digits: int = 80) -> mp.mpc:
    values = np.asarray(vector, dtype=object)
    with _precision(decimal_digits):
        _ensure_finite(values, "vector")
        return mp.sqrt(mp.fsum(_mpc(value) ** 2 for value in values))


def direct_sum_2d_mp(
    targets: ArrayLike,
    sources: ArrayLike,
    strengths: ArrayLike,
    *,
    kernel: Literal["laplace", "helmholtz"] = "laplace",
    wavenumber: object | None = None,
    decimal_digits: int = 80,
) -> MPArray:
    target_points = _object_points(targets, 2, "targets")
    source_points = _object_points(sources, 2, "sources")
    charges = _object_strengths(strengths, len(source_points))
    if kernel not in ("laplace", "helmholtz"):
        raise ValueError(f"unsupported kernel: {kernel}")
    with _precision(decimal_digits):
        _ensure_finite(target_points, "targets")
        _ensure_finite(source_points, "sources")
        _ensure_finite(charges, "strengths")
        kappa = _positive_wavenumber(wavenumber) if kernel == "helmholtz" else None
        result = np.empty(len(target_points), dtype=object)
        for target_index, target in enumerate(target_points):
            total = mp.mpc(0)
            for source, charge in zip(source_points, charges, strict=True):
                radius = mp.sqrt(
                    mp.fsum((_mpc(a) - _mpc(b)) ** 2 for a, b in zip(target, source, strict=True))
                )
                kernel_value = (
                    mp.log(radius) if kernel == "laplace" else mp.hankel1(0, mp.mpf(kappa) * radius)
                )
                total += _mpc(charge) * kernel_value
            result[target_index] = +total
    return result


def direct_sum_3d_mp(
    targets: ArrayLike,
    sources: ArrayLike,
    strengths: ArrayLike,
    *,
    kernel: Literal["laplace", "helmholtz"] = "laplace",
    wavenumber: object | None = None,
    decimal_digits: int = 80,
) -> MPArray:
    target_points = _object_points(targets, 3, "targets")
    source_points = _object_points(sources, 3, "sources")
    charges = _object_strengths(strengths, len(source_points))
    if kernel not in ("laplace", "helmholtz"):
        raise ValueError(f"unsupported kernel: {kernel}")
    with _precision(decimal_digits):
        _ensure_finite(target_points, "targets")
        _ensure_finite(source_points, "sources")
        _ensure_finite(charges, "strengths")
        kappa = _positive_wavenumber(wavenumber) if kernel == "helmholtz" else None
        result = np.empty(len(target_points), dtype=object)
        for target_index, target in enumerate(target_points):
            total = mp.mpc(0)
            for source, charge in zip(source_points, charges, strict=True):
                radius = mp.sqrt(
                    mp.fsum((_mpc(a) - _mpc(b)) ** 2 for a, b in zip(target, source, strict=True))
                )
                kernel_value = 1 / radius
                if kernel == "helmholtz":
                    kernel_value = mp.exp(1j * mp.mpf(kappa) * radius) / radius
                total += _mpc(charge) * kernel_value
            result[target_index] = +total
    return result
