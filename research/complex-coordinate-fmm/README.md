# Complex-coordinate fast multipole method

A validated reference implementation based on Goodwill et al., *Fast Multipole
Method with Complex Coordinates*, [arXiv:2509.05458](https://arxiv.org/abs/2509.05458).
The 3-D primitives explicitly correct documented scale, sign, and analytic-continuation
errors in the displayed preprint formulas rather than reproducing them literally.

- [Method quick reference](QUICK_REFERENCE.md)
- Complete adaptive 2-D Laplace and Helmholtz dual-tree FMM
- Individually testable 2-D P2M, M2M, M2L, L2L, P2L, M2P, and L2P operators
- 3-D Laplace and Helmholtz single-center analytic primitives
- NumPy/SciPy double precision and input-preserving mpmath direct validation oracles
- Numerical tests on genuinely complex coordinates and SymPy identity tests

## Install and test

```sh
uv sync --all-groups
uv run pytest
uv run ruff check .
```

## Two-dimensional use

```python
import numpy as np
from complex_coordinate_fmm import evaluate_fmm_2d

source_real = np.random.default_rng(4).uniform(-1, 1, (1000, 2))
target_real = np.random.default_rng(5).uniform(-1, 1, (800, 2))


# A Lipschitz complexification Im(x)=psi(Re(x)), ||D psi|| < 1.
def complexify(x: np.ndarray) -> np.ndarray:
    return x + 1j * np.column_stack((0.04 * x[:, 0], 0.03 * x[:, 1]))


sources = complexify(source_real)
targets = complexify(target_real)
strengths = np.ones(len(sources), dtype=complex)

laplace = evaluate_fmm_2d(
    targets,
    sources,
    strengths,
    kernel="laplace",
    order=18,
    max_points=24,
)

helmholtz = evaluate_fmm_2d(
    targets,
    sources,
    strengths,
    kernel="helmholtz",
    wavenumber=2.0,
    order=20,
    max_points=24,
)

print(laplace.values, laplace.stats)
```

The returned 2-D kernels follow the preprint's expansion conventions: `log(r)`
and `H_0^(1)(k*r)`. Multiply by `-1/(2*pi)` or `1j/4` respectively for physical
Green's functions.

`separation_safety` controls the exact two-channel M2L convergence margin. The
default `2.0` is deliberately conservative. Accuracy is controlled jointly by
this margin and `order`; the API does not infer a tolerance from unverified
geometry.

For self sums, pass the exact same point array as sources and targets with
`exclude_self=True`. Singular pairs are never silently discarded otherwise.

## Scope

The multi-level solver is complete for the paper's 2-D kernels. The 3-D module
provides validated spherical harmonics, direct kernels, P2M/P2L formation, and
multipole/local evaluation. It deliberately does not advertise a complete 3-D
FMM: the preprint's fast point-and-shoot Helmholtz translations require a
substantial wideband/stability implementation, and several displayed 3-D
formulas contain index, sign, or scale inconsistencies documented in the quick
reference.

This is research reference code, not a replacement for a tuned production FMM.
The dual-tree traversal has linear behavior for balanced bounded-density data;
pathological distributions are not promised worst-case O(N).
