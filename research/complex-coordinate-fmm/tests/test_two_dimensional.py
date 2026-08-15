import numpy as np
from numpy.testing import assert_allclose

from complex_coordinate_fmm.two_dimensional import (
    direct_sum_2d,
    evaluate_helmholtz_local,
    evaluate_helmholtz_multipole,
    evaluate_laplace_local,
    evaluate_laplace_multipole,
    helmholtz_l2l,
    helmholtz_m2l,
    helmholtz_m2m,
    helmholtz_p2l,
    helmholtz_p2m,
    laplace_l2l,
    laplace_m2l,
    laplace_m2m,
    laplace_p2l,
    laplace_p2m,
)


def geometry():
    # imag = psi(real) with a linear map whose spectral norm is below 0.1
    sources_real = np.array([[-2.1, -0.1], [-1.9, 0.15], [-2.0, -0.2]])
    targets_real = np.array([[1.8, -0.15], [2.1, 0.2], [1.95, 0.05]])
    matrix = np.array([[0.04, 0.01], [-0.02, 0.03]])
    sources = sources_real + 1j * (sources_real @ matrix.T)
    targets = targets_real + 1j * (targets_real @ matrix.T)
    strengths = np.array([1.2 - 0.3j, -0.7 + 0.2j, 0.4 + 0.5j])
    return sources, targets, strengths


def test_laplace_operators_match_direct():
    sources, targets, strengths = geometry()
    source_center = np.array([-2.0, 0.0]) + 1j * np.array([-0.08, 0.04])
    parent_center = np.array([-1.5, 0.0]) + 1j * np.array([-0.06, 0.03])
    target_center = np.array([2.0, 0.0]) + 1j * np.array([0.08, -0.04])
    child_center = np.array([1.95, 0.03]) + 1j * np.array([0.0783, -0.0381])
    order = 18
    direct = direct_sum_2d(targets, sources, strengths)

    multipole = laplace_p2m(sources, strengths, source_center, order)
    assert_allclose(
        evaluate_laplace_multipole(multipole, targets, source_center),
        direct,
        rtol=2e-14,
        atol=2e-14,
    )

    shifted = laplace_m2m(multipole, source_center, parent_center)
    assert_allclose(
        evaluate_laplace_multipole(shifted, targets, parent_center), direct, rtol=2e-10, atol=2e-10
    )

    local = laplace_m2l(multipole, source_center, target_center)
    assert_allclose(
        evaluate_laplace_local(local, targets, target_center), direct, rtol=2e-13, atol=2e-13
    )

    direct_local = laplace_p2l(sources, strengths, target_center, order)
    assert_allclose(
        evaluate_laplace_local(direct_local, targets, target_center), direct, rtol=2e-14, atol=2e-14
    )

    child = laplace_l2l(local, target_center, child_center)
    assert_allclose(
        evaluate_laplace_local(child, targets, child_center), direct, rtol=2e-13, atol=2e-13
    )


def test_helmholtz_operators_converge_to_direct():
    sources, targets, strengths = geometry()
    source_center = np.array([-2.0, 0.0]) + 1j * np.array([-0.08, 0.04])
    parent_center = np.array([-1.5, 0.0]) + 1j * np.array([-0.06, 0.03])
    target_center = np.array([2.0, 0.0]) + 1j * np.array([0.08, -0.04])
    child_center = np.array([1.95, 0.03]) + 1j * np.array([0.0783, -0.0381])
    order = 20
    kappa = 1.3
    direct = direct_sum_2d(targets, sources, strengths, kernel="helmholtz", wavenumber=kappa)

    multipole = helmholtz_p2m(sources, strengths, source_center, order, kappa)
    assert_allclose(
        evaluate_helmholtz_multipole(multipole, targets, source_center, kappa),
        direct,
        rtol=2e-13,
        atol=2e-13,
    )

    shifted = helmholtz_m2m(multipole, source_center, parent_center, kappa)
    assert_allclose(
        evaluate_helmholtz_multipole(shifted, targets, parent_center, kappa),
        direct,
        rtol=2e-9,
        atol=2e-9,
    )

    local = helmholtz_m2l(multipole, source_center, target_center, kappa)
    assert_allclose(
        evaluate_helmholtz_local(local, targets, target_center, kappa),
        direct,
        rtol=2e-12,
        atol=2e-12,
    )

    direct_local = helmholtz_p2l(sources, strengths, target_center, order, kappa)
    assert_allclose(
        evaluate_helmholtz_local(direct_local, targets, target_center, kappa),
        direct,
        rtol=2e-13,
        atol=2e-13,
    )

    child = helmholtz_l2l(local, target_center, child_center, kappa)
    assert_allclose(
        evaluate_helmholtz_local(child, targets, child_center, kappa),
        direct,
        rtol=2e-12,
        atol=2e-12,
    )
