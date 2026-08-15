"""Complex polar/spherical coordinates without Hermitian conjugation.

All quadratic radii use ``sqrt(sum(x_j**2))`` exactly as in the paper.  They
are not Euclidean norms of complex vectors.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import factorial

import numpy as np
from numpy.typing import ArrayLike, NDArray

ComplexArray = NDArray[np.complex128]


def as_points(points: ArrayLike, dimension: int) -> ComplexArray:
    """Validate and return an ``(N, dimension)`` complex array."""
    value = np.asarray(points, dtype=np.complex128)
    if value.ndim != 2 or value.shape[1] != dimension:
        raise ValueError(f"points must have shape (N, {dimension})")
    if not np.all(np.isfinite(value)):
        raise ValueError("points must be finite")
    return value


def complex_radius(vector: ArrayLike) -> ComplexArray:
    """Return the principal analytic radius ``sqrt(sum(vector**2))``."""
    value = np.asarray(vector, dtype=np.complex128)
    return np.sqrt(np.sum(value * value, axis=-1))


def channels_2d(vector: ArrayLike) -> tuple[ComplexArray, ComplexArray]:
    """Return ``z_+ = x1+i*x2`` and ``z_- = x1-i*x2``.

    These are algebraic channels; the ``i`` here is independent of imaginary
    components already present in ``x1`` and ``x2``.
    """
    value = np.asarray(vector, dtype=np.complex128)
    if value.shape[-1] != 2:
        raise ValueError("vector must end in dimension 2")
    return value[..., 0] + 1j * value[..., 1], value[..., 0] - 1j * value[..., 1]


@dataclass(frozen=True)
class PolarFactors:
    radius: ComplexArray
    phase_plus: ComplexArray
    phase_minus: ComplexArray


def polar_factors(vector: ArrayLike) -> PolarFactors:
    """Return principal radius and ``exp(±i phi)`` for complex 2-D vectors."""
    plus, minus = channels_2d(vector)
    radius = np.sqrt(plus * minus)
    if np.any(radius == 0):
        raise ValueError("complex polar factors are singular at zero analytic radius")
    return PolarFactors(radius, plus / radius, minus / radius)


@dataclass(frozen=True)
class SphericalFactors:
    radius: complex
    cos_theta: complex
    phase_plus: complex
    phase_minus: complex


def spherical_factors(vector: ArrayLike) -> SphericalFactors:
    """Return branch-consistent factors used by the paper's spherical harmonics."""
    value = np.asarray(vector, dtype=np.complex128)
    if value.shape != (3,):
        raise ValueError("vector must have shape (3,)")
    radius = complex(np.sqrt(np.dot(value, value)))
    if radius == 0:
        raise ValueError("complex spherical coordinates require nonzero analytic radius")
    transverse = complex(np.sqrt(value[0] ** 2 + value[1] ** 2))
    if transverse == 0:
        phase_plus = phase_minus = 1.0 + 0.0j
    else:
        phase_plus = complex((value[0] + 1j * value[1]) / transverse)
        phase_minus = complex((value[0] - 1j * value[1]) / transverse)
    return SphericalFactors(radius, complex(value[2] / radius), phase_plus, phase_minus)


def associated_legendre(n: int, m: int, z: complex) -> complex:
    """Evaluate the Ferrers polynomial ``P_n^m(z)`` by analytic recurrence."""
    if n < 0 or m < 0 or m > n:
        raise ValueError("require n >= m >= 0")
    p_mm = 1.0 + 0.0j
    if m:
        root = np.sqrt(1.0 - z * z)
        odd_double_factorial = 1
        for k in range(1, m + 1):
            odd_double_factorial *= 2 * k - 1
        p_mm = (-1) ** m * odd_double_factorial * root**m
    if n == m:
        return complex(p_mm)
    p_m1m = (2 * m + 1) * z * p_mm
    if n == m + 1:
        return complex(p_m1m)
    previous, current = p_mm, p_m1m
    for degree in range(m + 2, n + 1):
        following = ((2 * degree - 1) * z * current - (degree + m - 1) * previous) / (degree - m)
        previous, current = current, following
    return complex(current)


def spherical_harmonic(n: int, m: int, vector: ArrayLike) -> complex:
    r"""Evaluate the paper's semi-normalized analytic spherical harmonic.

    .. math::
       Y_n^m=(-1)^m\sqrt{(n-|m|)!/(n+|m|)!}\,P_n^{|m|}(\cos\theta)e^{im\phi}.

    This convention has ``Y_0^0=1`` and its addition theorem sums directly to
    ``P_n(cos(alpha))`` (there is no ``4*pi/(2*n+1)`` factor).
    """
    if n < 0 or abs(m) > n:
        raise ValueError("require n >= 0 and |m| <= n")
    factors = spherical_factors(vector)
    degree = abs(m)
    normalization = np.sqrt(factorial(n - degree) / factorial(n + degree))
    phase = factors.phase_plus**m if m >= 0 else factors.phase_minus ** (-m)
    return complex(
        (-1) ** m * normalization * associated_legendre(n, degree, factors.cos_theta) * phase
    )


def empirical_lipschitz_constant(points: ArrayLike) -> float:
    """Compute the exact pairwise Lipschitz quotient of sampled complex points.

    This is a diagnostic for the paper's assumption, not proof of a global
    complexification map.  Duplicate real locations with unequal imaginary
    parts yield infinity.
    """
    value = np.asarray(points, dtype=np.complex128)
    if value.ndim != 2:
        raise ValueError("points must be a matrix")
    maximum = 0.0
    for i in range(len(value)):
        real_distance = np.linalg.norm(value.real[i + 1 :] - value.real[i], axis=1)
        imaginary_distance = np.linalg.norm(value.imag[i + 1 :] - value.imag[i], axis=1)
        duplicate = real_distance == 0
        if np.any(duplicate & (imaginary_distance != 0)):
            return float("inf")
        valid = ~duplicate
        if np.any(valid):
            maximum = max(maximum, float(np.max(imaginary_distance[valid] / real_distance[valid])))
    return maximum
