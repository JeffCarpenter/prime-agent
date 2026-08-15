import numpy as np
from numpy.testing import assert_allclose

from complex_coordinate_fmm.coordinates import spherical_harmonic
from complex_coordinate_fmm.three_dimensional import (
    c_l_3d,
    direct_sum_3d,
    evaluate_helmholtz_local_3d,
    evaluate_helmholtz_multipole_3d,
    evaluate_laplace_local_3d,
    evaluate_laplace_multipole_3d,
    helmholtz_p2l_3d,
    helmholtz_p2m_3d,
    laplace_p2l_3d,
    laplace_p2m_3d,
    z_c_3d,
)


def geometry():
    source_real = np.array([[-0.2, 0.1, -0.1], [0.15, -0.12, 0.08], [0.05, 0.18, 0.14]])
    target_real = np.array([[2.8, 0.2, -0.1], [3.1, -0.3, 0.25], [2.9, 0.15, 0.3]])
    matrix = np.array([[0.025, 0.004, -0.003], [-0.006, 0.02, 0.002], [0.003, -0.005, 0.018]])
    sources = source_real + 1j * (source_real @ matrix.T)
    targets = target_real + 1j * (target_real @ matrix.T)
    strengths = np.array([1.0 - 0.3j, -0.4 + 0.2j, 0.7 + 0.1j])
    return sources, targets, strengths


def test_spherical_harmonic_addition_convention():
    x = np.array([1.2 + 0.02j, -0.3 + 0.01j, 0.7 - 0.02j])
    y = np.array([-0.4 - 0.01j, 0.8 + 0.02j, 1.1 + 0.01j])
    cos_alpha = np.dot(x, y) / np.sqrt(np.dot(x, x) * np.dot(y, y))
    # P_3(z)=(5z^3-3z)/2
    expected = (5 * cos_alpha**3 - 3 * cos_alpha) / 2
    actual = sum(spherical_harmonic(3, -m, y) * spherical_harmonic(3, m, x) for m in range(-3, 4))
    assert_allclose(actual, expected, rtol=2e-14, atol=2e-14)
    assert spherical_harmonic(0, 0, np.array([0.0, 0.0, 2.0])) == 1


def test_laplace_3d_multipole_and_local_match_direct():
    sources, targets, strengths = geometry()
    source_center = np.zeros(3, dtype=complex)
    target_center = np.array([2.95, 0.02, 0.1]) + 1j * np.array([0.07353, -0.01796, 0.01055])
    direct = direct_sum_3d(targets, sources, strengths)
    multipole = laplace_p2m_3d(sources, strengths, source_center, 15)
    local = laplace_p2l_3d(sources, strengths, target_center, 15)
    assert_allclose(
        evaluate_laplace_multipole_3d(multipole, targets, source_center),
        direct,
        rtol=2e-12,
        atol=2e-12,
    )
    assert_allclose(
        evaluate_laplace_local_3d(local, targets, target_center), direct, rtol=2e-13, atol=2e-13
    )


def test_helmholtz_3d_scaling_and_sign_match_stated_kernel():
    sources, targets, strengths = geometry()
    source_center = np.zeros(3, dtype=complex)
    target_center = np.array([2.95, 0.02, 0.1]) + 1j * np.array([0.07353, -0.01796, 0.01055])
    kappa = 1.4
    direct = direct_sum_3d(targets, sources, strengths, kernel="helmholtz", wavenumber=kappa)
    multipole = helmholtz_p2m_3d(sources, strengths, source_center, 16, kappa)
    local = helmholtz_p2l_3d(sources, strengths, target_center, 16, kappa)
    assert_allclose(
        evaluate_helmholtz_multipole_3d(multipole, targets, source_center, kappa),
        direct,
        rtol=3e-12,
        atol=3e-12,
    )
    assert_allclose(
        evaluate_helmholtz_local_3d(local, targets, target_center, kappa),
        direct,
        rtol=3e-12,
        atol=3e-12,
    )


def test_three_dimensional_admissibility_helpers():
    assert c_l_3d(0) == 1
    assert 0 < z_c_3d(2.5) < 1
