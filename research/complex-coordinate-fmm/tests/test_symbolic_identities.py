import sympy as sp


def test_characteristic_channels_factor_analytic_radius():
    x1, x2 = sp.symbols("x1 x2")
    assert sp.expand((x1 + sp.I * x2) * (x1 - sp.I * x2)) == x1**2 + x2**2


def test_laplace_m2m_formula_is_exact_moment_shift():
    q, d, sigma = sp.symbols("q d sigma")
    for k in range(1, 8):
        translated = -sigma * d**k / (2 * k)
        for n in range(1, k + 1):
            old_moment = -sigma * q**n / (2 * n)
            translated += sp.binomial(k - 1, n - 1) * d ** (k - n) * old_moment
        expected = -sigma * (q + d) ** k / (2 * k)
        assert sp.simplify(translated - expected) == 0


def test_laplace_m2l_coefficients_are_taylor_coefficients():
    q, displacement = sp.symbols("q displacement", nonzero=True)
    # For n=1..5, compare the implemented coefficient to derivatives of
    # (q-displacement)^(-n) about q=0.
    for degree in range(1, 6):
        function = (q - displacement) ** (-degree)
        for k in range(0, 6):
            coefficient = sp.diff(function, q, k).subs(q, 0) / sp.factorial(k)
            implemented = (
                (-1) ** degree * sp.binomial(degree + k - 1, k) / displacement ** (degree + k)
            )
            assert sp.simplify(coefficient - implemented) == 0
    # The monopole channel contributes one half of log(q-displacement).
    for k in range(1, 6):
        coefficient = sp.diff(sp.log(q - displacement) / 2, q, k).subs(q, 0) / sp.factorial(k)
        assert sp.simplify(coefficient + 1 / (2 * k * displacement**k)) == 0


def test_laplace_l2l_is_polynomial_taylor_shift():
    q, d = sp.symbols("q d")
    coefficients = sp.symbols("L0:7")
    polynomial = sum(coefficients[n] * (q + d) ** n for n in range(7))
    for k in range(7):
        translated = sum(sp.binomial(n, k) * d ** (n - k) * coefficients[n] for n in range(k, 7))
        actual = sp.expand(polynomial).coeff(q, k)
        assert sp.simplify(actual - translated) == 0
