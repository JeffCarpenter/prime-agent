import numpy as np
from numpy.testing import assert_allclose

from complex_coordinate_fmm.fmm import evaluate_fmm_2d
from complex_coordinate_fmm.two_dimensional import direct_sum_2d


def complexify(real):
    matrix = np.array([[0.055, -0.012], [0.018, 0.043]])
    return real + 1j * (real @ matrix.T + np.array([0.02, -0.01]))


def test_adaptive_laplace_fmm_uses_far_and_near_paths():
    rng = np.random.default_rng(7342)
    sources = complexify(rng.uniform(-1, 1, size=(180, 2)))
    targets = complexify(rng.uniform(-1, 1, size=(130, 2)))
    strengths = rng.normal(size=180) + 1j * rng.normal(size=180)
    direct = direct_sum_2d(targets, sources, strengths)
    answer = evaluate_fmm_2d(
        targets,
        sources,
        strengths,
        order=18,
        max_points=10,
        separation_safety=2.5,
    )
    assert answer.stats.m2l_translations > 0
    assert answer.stats.direct_particle_pairs > 0
    assert_allclose(answer.values, direct, rtol=3e-9, atol=3e-9)


def test_adaptive_helmholtz_fmm_matches_direct():
    rng = np.random.default_rng(994)
    sources = complexify(rng.uniform(-0.8, 0.8, size=(100, 2)))
    targets = complexify(rng.uniform(-0.8, 0.8, size=(75, 2)))
    strengths = rng.normal(size=100) + 1j * rng.normal(size=100)
    kappa = 1.7
    direct = direct_sum_2d(targets, sources, strengths, kernel="helmholtz", wavenumber=kappa)
    answer = evaluate_fmm_2d(
        targets,
        sources,
        strengths,
        kernel="helmholtz",
        wavenumber=kappa,
        order=19,
        max_points=9,
        separation_safety=2.5,
    )
    assert answer.stats.m2l_translations > 0
    assert_allclose(answer.values, direct, rtol=2e-8, atol=2e-8)


def test_exclude_self_removes_only_diagonal_pairs():
    real = np.array([[-0.6, -0.1], [0.2, 0.3], [0.7, -0.2]])
    points = complexify(real)
    strengths = np.array([1.0, 2.0, -0.4j])
    expected = direct_sum_2d(
        points,
        points,
        strengths,
        exclude_pairs={(0, 0), (1, 1), (2, 2)},
    )
    actual = evaluate_fmm_2d(points, points, strengths, max_points=1, order=14, exclude_self=True)
    assert_allclose(actual.values, expected, rtol=1e-11, atol=1e-11)


def test_helmholtz_exclude_self_removes_diagonal_kernel_values():
    real = np.array([[-0.6, -0.1], [0.2, 0.3], [0.7, -0.2]])
    points = complexify(real)
    strengths = np.array([1.0, 2.0, -0.4j])
    excluded = {(0, 0), (1, 1), (2, 2)}
    expected = direct_sum_2d(
        points,
        points,
        strengths,
        kernel="helmholtz",
        wavenumber=1.7,
        exclude_pairs=excluded,
    )
    actual = evaluate_fmm_2d(
        points,
        points,
        strengths,
        kernel="helmholtz",
        wavenumber=1.7,
        max_points=1,
        order=16,
        exclude_self=True,
    )
    assert_allclose(actual.values, expected, rtol=1e-11, atol=1e-11)


def test_duplicate_real_geometry_stops_unproductive_subdivision():
    sources = np.repeat(np.array([[0.1 + 0.002j, -0.2 - 0.006j]]), 20, axis=0)
    targets = np.array([[2.0 + 0.04j, 0.3 + 0.009j]])
    answer = evaluate_fmm_2d(
        targets,
        sources,
        np.ones(20),
        max_points=1,
        max_depth=512,
    )
    assert answer.stats.source_depth == 0
    assert np.isfinite(answer.values).all()
