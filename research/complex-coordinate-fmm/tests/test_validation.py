import numpy as np
import pytest
from numpy.testing import assert_array_equal

from complex_coordinate_fmm.fmm import evaluate_fmm_2d
from complex_coordinate_fmm.high_precision import direct_sum_2d_mp, direct_sum_3d_mp
from complex_coordinate_fmm.three_dimensional import (
    direct_sum_3d,
    evaluate_helmholtz_local_3d,
    evaluate_helmholtz_multipole_3d,
    helmholtz_p2l_3d,
    helmholtz_p2m_3d,
)
from complex_coordinate_fmm.two_dimensional import (
    HelmholtzLocal,
    HelmholtzMultipole,
    direct_sum_2d,
    evaluate_helmholtz_local,
    evaluate_helmholtz_multipole,
    helmholtz_l2l,
    helmholtz_m2l,
    helmholtz_m2m,
    helmholtz_p2l,
    helmholtz_p2m,
)


@pytest.mark.parametrize("invalid", [float("nan"), float("inf"), -1.0, 0.0])
def test_public_helmholtz_apis_reject_invalid_wavenumbers(invalid):
    points2 = np.array([[0.1 + 0.01j, 0.2 - 0.01j]])
    targets2 = np.array([[1.0 + 0.02j, 0.3]])
    points3 = np.column_stack((points2, np.array([0.05 + 0.01j])))
    targets3 = np.column_stack((targets2, np.array([0.2 + 0.01j])))
    center2 = np.zeros(2, complex)
    center3 = np.zeros(3, complex)
    multipole2 = HelmholtzMultipole(np.ones(3, complex))
    local2 = HelmholtzLocal(np.ones(3, complex))

    calls = [
        lambda: direct_sum_2d(targets2, points2, [1], kernel="helmholtz", wavenumber=invalid),
        lambda: helmholtz_p2m(points2, [1], center2, 1, invalid),
        lambda: helmholtz_p2l(points2, [1], targets2[0], 1, invalid),
        lambda: helmholtz_m2m(multipole2, center2, np.ones(2), invalid),
        lambda: helmholtz_m2l(multipole2, center2, np.ones(2), invalid),
        lambda: helmholtz_l2l(local2, center2, np.ones(2), invalid),
        lambda: evaluate_helmholtz_multipole(multipole2, targets2, center2, invalid),
        lambda: evaluate_helmholtz_local(local2, targets2, center2, invalid),
        lambda: direct_sum_3d(targets3, points3, [1], kernel="helmholtz", wavenumber=invalid),
        lambda: helmholtz_p2m_3d(points3, [1], center3, 1, invalid),
        lambda: helmholtz_p2l_3d(points3, [1], targets3[0], 1, invalid),
        lambda: evaluate_helmholtz_multipole_3d(
            helmholtz_p2m_3d(points3, [1], center3, 1, 1.0), targets3, center3, invalid
        ),
        lambda: evaluate_helmholtz_local_3d(
            helmholtz_p2l_3d(points3, [1], targets3[0], 1, 1.0), targets3, targets3[0], invalid
        ),
        lambda: direct_sum_2d_mp(targets2, points2, [1], kernel="helmholtz", wavenumber=invalid),
        lambda: direct_sum_3d_mp(targets3, points3, [1], kernel="helmholtz", wavenumber=invalid),
    ]
    for call in calls:
        with pytest.raises(ValueError):
            call()


def test_negative_helmholtz_orders_are_rejected_consistently():
    points = np.array([[0.1 + 0.01j, 0.2 - 0.01j]])
    with pytest.raises(ValueError, match="order"):
        helmholtz_p2m(points, [1], np.zeros(2), -1, 1.0)
    with pytest.raises(ValueError, match="order"):
        helmholtz_p2l(points, [1], np.ones(2), -1, 1.0)


def test_zero_displacement_helmholtz_translations_are_identity_copies():
    center = np.array([0.2 + 0.01j, -0.1 + 0.02j])
    multipole = HelmholtzMultipole(np.array([1 + 2j, -0.4j, 0.7]))
    local = HelmholtzLocal(np.array([-0.2j, 1.3, 0.4 + 0.1j]))
    shifted_multipole = helmholtz_m2m(multipole, center, center.copy(), 1.2)
    shifted_local = helmholtz_l2l(local, center, center.copy(), 1.2)
    assert_array_equal(shifted_multipole.coefficients, multipole.coefficients)
    assert_array_equal(shifted_local.coefficients, local.coefficients)
    assert shifted_multipole is not multipole
    assert shifted_local is not local


def test_fmm_rejects_recursion_unsafe_max_depth():
    points = np.array([[0.0, 0.0], [1.0, 1.0]], complex)
    with pytest.raises(ValueError, match="max_depth"):
        evaluate_fmm_2d(points, points, np.ones(2), max_depth=513)
