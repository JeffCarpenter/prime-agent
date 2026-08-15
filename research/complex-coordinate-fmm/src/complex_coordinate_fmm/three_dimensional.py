"""Validated three-dimensional analytic primitives from arXiv:2509.05458.

This module provides finite single-center expansions, not a multi-level 3-D
point-and-shoot implementation.  Coefficients use the paper's semi-normalized
spherical harmonics.  The Helmholtz evaluators include the ``i*k`` scale needed
for the stated kernel ``exp(i*k*r)/r``; that scale is omitted in the displayed
expansion in the preprint.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray
from scipy.special import spherical_jn, spherical_yn

from .coordinates import as_points, complex_radius, spherical_harmonic

ComplexArray = NDArray[np.complex128]


@dataclass
class SphericalExpansion:
    """Triangular coefficients stored at ``[n, m + order]``."""

    coefficients: ComplexArray
    kind: str

    @property
    def order(self) -> int:
        return self.coefficients.shape[0] - 1


def _validate_inputs(
    points: ArrayLike, strengths: ArrayLike, center: ArrayLike, order: int
) -> tuple[ComplexArray, ComplexArray, ComplexArray]:
    locations = as_points(points, 3)
    charges = np.asarray(strengths, dtype=np.complex128)
    origin = np.asarray(center, dtype=np.complex128)
    if charges.shape != (len(locations),) or not np.all(np.isfinite(charges)):
        raise ValueError(f"strengths must be finite with shape ({len(locations)},)")
    if origin.shape != (3,) or not np.all(np.isfinite(origin)):
        raise ValueError("center must be finite with shape (3,)")
    if order < 0:
        raise ValueError("order must be nonnegative")
    return locations, charges, origin


def _positive_wavenumber(wavenumber: float | None) -> float:
    if wavenumber is None or not np.isfinite(wavenumber) or wavenumber <= 0:
        raise ValueError("wavenumber must be positive and finite")
    return float(wavenumber)


def _hankel(order: int, argument: complex) -> complex:
    return complex(spherical_jn(order, argument) + 1j * spherical_yn(order, argument))


def laplace_kernel_3d(target: ArrayLike, source: ArrayLike) -> complex:
    radius = complex(complex_radius(np.asarray(target, complex) - np.asarray(source, complex)))
    return complex(1 / radius)


def helmholtz_kernel_3d(target: ArrayLike, source: ArrayLike, wavenumber: float) -> complex:
    kappa = _positive_wavenumber(wavenumber)
    radius = complex(complex_radius(np.asarray(target, complex) - np.asarray(source, complex)))
    return complex(np.exp(1j * kappa * radius) / radius)


def direct_sum_3d(
    targets: ArrayLike,
    sources: ArrayLike,
    strengths: ArrayLike,
    *,
    kernel: str = "laplace",
    wavenumber: float | None = None,
) -> ComplexArray:
    target_points = as_points(targets, 3)
    source_points = as_points(sources, 3)
    charges = np.asarray(strengths, dtype=np.complex128)
    if charges.shape != (len(source_points),) or not np.all(np.isfinite(charges)):
        raise ValueError(f"strengths must be finite with shape ({len(source_points)},)")
    kappa = _positive_wavenumber(wavenumber) if kernel == "helmholtz" else None
    result = np.zeros(len(target_points), dtype=np.complex128)
    for index, target in enumerate(target_points):
        radius = complex_radius(target - source_points)
        if kernel == "laplace":
            values = 1 / radius
        elif kernel == "helmholtz":
            values = np.exp(1j * float(kappa) * radius) / radius
        else:
            raise ValueError(f"unsupported kernel: {kernel}")
        result[index] = values @ charges
    return result


def laplace_p2m_3d(
    sources: ArrayLike, strengths: ArrayLike, center: ArrayLike, order: int
) -> SphericalExpansion:
    points, charges, origin = _validate_inputs(sources, strengths, center, order)
    coefficients = np.zeros((order + 1, 2 * order + 1), dtype=np.complex128)
    for point, charge in zip(points, charges, strict=True):
        difference = point - origin
        radius = complex(complex_radius(difference))
        if radius == 0:
            coefficients[0, order] += charge
            continue
        for n in range(order + 1):
            for m in range(-n, n + 1):
                coefficients[n, m + order] += (
                    charge * radius**n * spherical_harmonic(n, -m, difference)
                )
    return SphericalExpansion(coefficients, "laplace-multipole")


def laplace_p2l_3d(
    sources: ArrayLike, strengths: ArrayLike, center: ArrayLike, order: int
) -> SphericalExpansion:
    points, charges, origin = _validate_inputs(sources, strengths, center, order)
    coefficients = np.zeros((order + 1, 2 * order + 1), dtype=np.complex128)
    for point, charge in zip(points, charges, strict=True):
        difference = point - origin
        radius = complex(complex_radius(difference))
        if radius == 0:
            raise ValueError("a local source cannot coincide with its center")
        for n in range(order + 1):
            for m in range(-n, n + 1):
                coefficients[n, m + order] += (
                    charge * spherical_harmonic(n, -m, difference) / radius ** (n + 1)
                )
    return SphericalExpansion(coefficients, "laplace-local")


def evaluate_laplace_multipole_3d(
    expansion: SphericalExpansion, targets: ArrayLike, center: ArrayLike
) -> ComplexArray:
    if expansion.kind != "laplace-multipole":
        raise ValueError("expected a Laplace multipole expansion")
    points = as_points(targets, 3)
    origin = np.asarray(center, complex)
    result = np.zeros(len(points), dtype=np.complex128)
    for index, point in enumerate(points):
        difference = point - origin
        radius = complex(complex_radius(difference))
        for n in range(expansion.order + 1):
            for m in range(-n, n + 1):
                result[index] += (
                    expansion.coefficients[n, m + expansion.order]
                    * spherical_harmonic(n, m, difference)
                    / radius ** (n + 1)
                )
    return result


def evaluate_laplace_local_3d(
    expansion: SphericalExpansion, targets: ArrayLike, center: ArrayLike
) -> ComplexArray:
    if expansion.kind != "laplace-local":
        raise ValueError("expected a Laplace local expansion")
    points = as_points(targets, 3)
    origin = np.asarray(center, complex)
    result = np.zeros(len(points), dtype=np.complex128)
    for index, point in enumerate(points):
        difference = point - origin
        radius = complex(complex_radius(difference))
        if radius == 0:
            result[index] = expansion.coefficients[0, expansion.order]
            continue
        for n in range(expansion.order + 1):
            for m in range(-n, n + 1):
                result[index] += (
                    expansion.coefficients[n, m + expansion.order]
                    * radius**n
                    * spherical_harmonic(n, m, difference)
                )
    return result


def helmholtz_p2m_3d(
    sources: ArrayLike,
    strengths: ArrayLike,
    center: ArrayLike,
    order: int,
    wavenumber: float,
) -> SphericalExpansion:
    points, charges, origin = _validate_inputs(sources, strengths, center, order)
    kappa = _positive_wavenumber(wavenumber)
    coefficients = np.zeros((order + 1, 2 * order + 1), dtype=np.complex128)
    for point, charge in zip(points, charges, strict=True):
        difference = point - origin
        radius = complex(complex_radius(difference))
        for n in range(order + 1):
            radial = spherical_jn(n, kappa * radius)
            for m in range(-n, n + 1):
                harmonic = (
                    1.0
                    if radius == 0 and n == 0
                    else (0.0 if radius == 0 else spherical_harmonic(n, -m, difference))
                )
                coefficients[n, m + order] += (2 * n + 1) * charge * radial * harmonic
    return SphericalExpansion(coefficients, "helmholtz-multipole")


def helmholtz_p2l_3d(
    sources: ArrayLike,
    strengths: ArrayLike,
    center: ArrayLike,
    order: int,
    wavenumber: float,
) -> SphericalExpansion:
    points, charges, origin = _validate_inputs(sources, strengths, center, order)
    kappa = _positive_wavenumber(wavenumber)
    coefficients = np.zeros((order + 1, 2 * order + 1), dtype=np.complex128)
    for point, charge in zip(points, charges, strict=True):
        difference = point - origin
        radius = complex(complex_radius(difference))
        if radius == 0:
            raise ValueError("a local source cannot coincide with its center")
        for n in range(order + 1):
            radial = _hankel(n, kappa * radius)
            for m in range(-n, n + 1):
                # No (-1)^n: direct validation and the standard Gegenbauer
                # addition theorem show the preprint's displayed local sign is a typo.
                coefficients[n, m + order] += (
                    (2 * n + 1) * charge * radial * spherical_harmonic(n, -m, difference)
                )
    return SphericalExpansion(coefficients, "helmholtz-local")


def evaluate_helmholtz_multipole_3d(
    expansion: SphericalExpansion,
    targets: ArrayLike,
    center: ArrayLike,
    wavenumber: float,
) -> ComplexArray:
    if expansion.kind != "helmholtz-multipole":
        raise ValueError("expected a Helmholtz multipole expansion")
    kappa = _positive_wavenumber(wavenumber)
    points = as_points(targets, 3)
    origin = np.asarray(center, complex)
    result = np.zeros(len(points), dtype=np.complex128)
    for index, point in enumerate(points):
        difference = point - origin
        radius = complex(complex_radius(difference))
        for n in range(expansion.order + 1):
            radial = _hankel(n, kappa * radius)
            for m in range(-n, n + 1):
                result[index] += (
                    expansion.coefficients[n, m + expansion.order]
                    * radial
                    * spherical_harmonic(n, m, difference)
                )
    return 1j * kappa * result


def evaluate_helmholtz_local_3d(
    expansion: SphericalExpansion,
    targets: ArrayLike,
    center: ArrayLike,
    wavenumber: float,
) -> ComplexArray:
    if expansion.kind != "helmholtz-local":
        raise ValueError("expected a Helmholtz local expansion")
    kappa = _positive_wavenumber(wavenumber)
    points = as_points(targets, 3)
    origin = np.asarray(center, complex)
    result = np.zeros(len(points), dtype=np.complex128)
    for index, point in enumerate(points):
        difference = point - origin
        radius = complex(complex_radius(difference))
        for n in range(expansion.order + 1):
            radial = spherical_jn(n, kappa * radius)
            for m in range(-n, n + 1):
                harmonic = (
                    1.0
                    if radius == 0 and n == 0
                    else (0.0 if radius == 0 else spherical_harmonic(n, m, difference))
                )
                result[index] += expansion.coefficients[n, m + expansion.order] * radial * harmonic
    return 1j * kappa * result


def c_l_3d(lipschitz: float) -> float:
    if not 0 <= lipschitz < 1:
        raise ValueError("lipschitz must be in [0, 1)")
    return float(np.sqrt(lipschitz**2 + 10 * lipschitz + 1) / (1 - lipschitz))


def z_c_3d(separation_ratio: float) -> float:
    if separation_ratio <= 1:
        raise ValueError("separation_ratio must exceed 1")
    c2 = separation_ratio**2
    return float((c2 + 5 - np.sqrt(12 * c2 + 24)) / (c2 - 1))


def laplace_3d_error_bound(
    charge_norm: float,
    lipschitz: float,
    source_radius: float,
    target_radius: float,
    order: int,
) -> float:
    """Theorem 5.2 finite multipole remainder bound."""
    if charge_norm < 0 or source_radius <= 0 or target_radius <= source_radius or order < 1:
        raise ValueError("invalid error-bound parameters")
    c_tilde = target_radius / (c_l_3d(lipschitz) * source_radius)
    if c_tilde <= 1:
        raise ValueError("the paper's sufficient 3-D separation condition is not met")
    return float(
        charge_norm
        / (np.sqrt(1 - lipschitz**2) * target_radius * (c_tilde - 1))
        * c_tilde ** (-order)
    )
