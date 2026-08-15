import mpmath as mp
import numpy as np
from numpy.testing import assert_allclose

from complex_coordinate_fmm.high_precision import direct_sum_2d_mp, direct_sum_3d_mp
from complex_coordinate_fmm.three_dimensional import direct_sum_3d
from complex_coordinate_fmm.two_dimensional import direct_sum_2d


def _complex_array(values):
    return np.array([complex(value) for value in values])


def test_mpmath_oracles_agree_with_double_precision_away_from_cancellation():
    sources2 = np.array([[-0.3 + 0.01j, 0.2 - 0.02j], [0.1 - 0.01j, -0.2 + 0.01j]])
    targets2 = np.array([[1.5 + 0.03j, 0.4 - 0.01j]])
    strengths = np.array([1.2 - 0.1j, -0.4 + 0.3j])
    assert_allclose(
        _complex_array(direct_sum_2d_mp(targets2, sources2, strengths)),
        direct_sum_2d(targets2, sources2, strengths),
        rtol=2e-15,
        atol=2e-15,
    )
    assert_allclose(
        _complex_array(
            direct_sum_2d_mp(targets2, sources2, strengths, kernel="helmholtz", wavenumber=1.2)
        ),
        direct_sum_2d(targets2, sources2, strengths, kernel="helmholtz", wavenumber=1.2),
        rtol=2e-15,
        atol=2e-15,
    )

    sources3 = np.column_stack((sources2, np.array([0.05 + 0.01j, -0.08 + 0.01j])))
    targets3 = np.column_stack((targets2, np.array([0.3 + 0.01j])))
    assert_allclose(
        _complex_array(direct_sum_3d_mp(targets3, sources3, strengths)),
        direct_sum_3d(targets3, sources3, strengths),
        rtol=2e-15,
        atol=2e-15,
    )
    assert_allclose(
        _complex_array(
            direct_sum_3d_mp(targets3, sources3, strengths, kernel="helmholtz", wavenumber=1.2)
        ),
        direct_sum_3d(targets3, sources3, strengths, kernel="helmholtz", wavenumber=1.2),
        rtol=2e-15,
        atol=2e-15,
    )


def test_mpmath_oracle_preserves_subnormal_arbitrary_precision_coordinates():
    with mp.workdps(100):
        separation = mp.mpf("1e-400")
        targets = np.array([[separation, mp.mpf("0")]], dtype=object)
        sources = np.array([[mp.mpf("0"), mp.mpf("0")]], dtype=object)
        answer = direct_sum_2d_mp(
            targets,
            sources,
            np.array([mp.mpf("1")], dtype=object),
            decimal_digits=90,
        )[0]
        assert mp.isfinite(answer)
        assert mp.almosteq(answer, mp.log(separation), rel_eps=mp.mpf("1e-85"))
