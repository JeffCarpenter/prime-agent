# Fast Multipole Method with Complex Coordinates — quick reference

Source: T. Goodwill, L. Greengard, J. Hoskins, M. Rachh, and Y. Wang,
*Fast Multipole Method with Complex Coordinates*, arXiv:2509.05458.
The source tarball was fetched from <https://arxiv.org/src/2509.05458>; the
retrieved gzip SHA-256 was
`23ebf0d3f06501685e9e4e03ab963c357a23511df799d2c68884203b22eac153`.
Equation labels below refer to the preprint source.

## 1. What changes from a classical FMM

The algebraic expansion and translation formulas are analytic continuations of
the classical Laplace/Helmholtz FMM formulas. The essential changes are:

1. Coordinates, centers, strengths, radii, angles, Bessel functions, and
   spherical harmonics may be complex.
2. A spatial tree is built **only from the real parts** of points.
3. Convergence must be checked in the analytically continued geometry; ordinary
   real-box separation alone is insufficient.
4. A box with real center `c` is ideally centered at
   `c + i psi(c)`. If `psi` is unavailable, the paper uses the mean imaginary
   part of points in that box (eq. `complexify_center_average`).

This repository implements a complete adaptive two-dimensional dual-tree FMM
using the paper's expansions. It provides separately validated 3-D single-center
primitives. It does **not** claim that the 3-D point-and-shoot implementation,
which the paper describes only partly, is complete.

## 2. Geometry and branches

Points lie on a graph

```text
Im(x) = psi(Re(x)),       ||psi(a)-psi(b)|| <= L ||a-b||,       L < 1.
```

All products are bilinear, not Hermitian. In particular,

```text
r(x)   = sqrt(x1^2 + x2^2),
rho(x) = sqrt(x1^2 + x2^2 + x3^2),
```

using one consistent square-root branch. No complex conjugates occur in these
radii. The implementation uses NumPy/mpmath principal branches and never
materializes a complex angle where algebraic phase factors suffice.

### 2-D characteristic channels

Define

```text
z_+(x) = x1 + i x2 = r exp(+i phi),
z_-(x) = x1 - i x2 = r exp(-i phi),
z_+(x) z_-(x) = r^2.
```

Then

```text
r^n exp(+in phi) = z_+^n,       exp(+in phi)/r^n = 1/z_-^n,
r^n exp(-in phi) = z_-^n,       exp(-in phi)/r^n = 1/z_+^n.
```

These identities eliminate angle branch ambiguity and expose both convergence
channels explicitly.

### Sufficient geometric separation

For source real radius `r`, target real radius `R > r`:

```text
2-D: L < (R-r)/(R+r),
     c_tilde = (1-L)R / ((1+L)r) > 1.
```

For 3-D, with `c=R/r`:

```text
z_c = (c^2 + 5 - sqrt(12c^2+24))/(c^2-1),
L < z_c,
C_L = sqrt(L^2+10L+1)/(1-L),
c_tilde = R/(C_L r) > 1.
```

The 2-D implementation uses a sharper finite-cluster test before every M2L:
for source box `S`, target box `T`, and `D=c_S-c_T`, it requires

```text
safety * (max_S|z_+(y-c_S)| + max_T|z_+(x-c_T)|) < |z_+(D)|,
safety * (max_S|z_-(y-c_S)| + max_T|z_-(x-c_T)|) < |z_-(D)|.
```

This directly ensures both Taylor/Graf channels converge for the represented
point sets. Rejected leaf pairs are evaluated directly. The default safety is
2; values only slightly above 1 are valid but can require much larger orders.

## 3. Kernel conventions

The paper drops global constants while developing its FMM. This implementation
uses:

| Name | Implemented sum kernel | Physical Green's function |
|---|---|---|
| 2-D Laplace | `log(r)` | `-(1/(2 pi)) log(r)` |
| 2-D Helmholtz | `H_0^(1)(k r)` | `(i/4) H_0^(1)(k r)` |
| 3-D Laplace | `1/rho` | `(1/(4 pi rho))` |
| 3-D Helmholtz | `exp(i k rho)/rho` | `exp(i k rho)/(4 pi rho)` |

Apply the physical prefactor outside the FMM. Coincident source/target pairs are
singular. The 2-D API can explicitly exclude matching self indices.

## 4. Two-dimensional Laplace expansions

For sources `y_j`, strengths `sigma_j`, and a center translated to zero:

```text
M_0     = sum_j sigma_j,
M_n^+   = -(1/(2n)) sum_j z_-(y_j)^n sigma_j,
M_n^-   = -(1/(2n)) sum_j z_+(y_j)^n sigma_j.
```

The multipole evaluation is

```text
u(x) = M_0 log(r_x)
     + sum_{n>=1} M_n^+ / z_-(x)^n
     + sum_{n>=1} M_n^- / z_+(x)^n.
```

For sources exterior to a local center:

```text
L_0   = sum_j log(r_yj) sigma_j,
L_n^+ = -(1/(2n)) sum_j sigma_j / z_+(y_j)^n,
L_n^- = -(1/(2n)) sum_j sigma_j / z_-(y_j)^n,

u(x) = L_0 + sum_{n>=1}[L_n^+ z_+(x)^n + L_n^- z_-(x)^n].
```

For either expansion, with `A=sum|sigma_j|`, truncation at `P` obeys

```text
|error| <= A/(c_tilde-1) * c_tilde^(-P).
```

### Laplace translations

Let a multipole move from old center `c_o` to new center `c_n`, with
`d=c_o-c_n`:

```text
M~_0 = M_0,
M~_k^+ = -M_0 z_-(d)^k/(2k)
          + sum_{n=1}^k binom(k-1,n-1) z_-(d)^(k-n) M_n^+,
M~_k^- = -M_0 z_+(d)^k/(2k)
          + sum_{n=1}^k binom(k-1,n-1) z_+(d)^(k-n) M_n^-.
```

For M2L, let `D=c_source-c_target`:

```text
L_0 = M_0 log(r_D)
    + sum_{n>=1} (-1)^n [M_n^+/z_-(D)^n + M_n^-/z_+(D)^n],

L_k^+ = -M_0/(2k z_+(D)^k)
       + sum_{n>=1} (-1)^n binom(n+k-1,k) M_n^-/z_+(D)^(n+k),
L_k^- = -M_0/(2k z_-(D)^k)
       + sum_{n>=1} (-1)^n binom(n+k-1,k) M_n^+/z_-(D)^(n+k).
```

For L2L from parent to child, let `d=c_child-c_parent`:

```text
L~_0 = L_0 + sum_{n=1}^P [L_n^+ z_+(d)^n + L_n^- z_-(d)^n],
L~_k^± = sum_{n=k}^P binom(n,k) z_±(d)^(n-k) L_n^±.
```

The SymPy tests derive these formulas as exact binomial/Taylor identities.

## 5. Two-dimensional Helmholtz expansions

With integer orders `n`:

```text
M_n = sum_j J_n(k r_yj) exp(-in phi_yj) sigma_j,
u(x) = sum_n M_n H_n^(1)(k r_x) exp(+in phi_x).
```

A direct local expansion is

```text
L_n = sum_j H_n^(1)(k r_yj) exp(-in phi_yj) sigma_j,
u(x) = sum_n L_n J_n(k r_x) exp(+in phi_x).
```

Let `B_q(d)=J_q(k r_d) exp(-iq phi_d)`. Validated translation
orientations in the code are:

```text
M2M: M~_m = sum_n B_(m-n)(c_old-c_new) M_n,
L2L: L~_m = sum_n B_(m-n)(c_parent-c_child) L_n.
```

Let `C_q(D)=H_q^(1)(k r_D) exp(-iq phi_D)`:

```text
M2L: L_m = sum_n C_(m-n)(c_source-c_target) M_n.
```

These are algebraically equivalent to Graf-addition variants after reversing a
displacement/order convention. Each operator is independently tested against a
direct complex-coordinate sum; copying printed indices without fixing a single
center convention is error-prone.

For sufficiently large `P`, a single multipole/local truncation has asymptotic
bound

```text
|error| <=~ 2/[P pi (c_tilde-1)] * c_tilde^(-P).
```

The paper explicitly leaves rigorous truncation bounds for composed complex
Helmholtz translation operators open.

## 6. Three-dimensional primitives

The paper uses semi-normalized analytic spherical harmonics

```text
Y_n^m(theta,phi) = (-1)^m sqrt((n-|m|)!/(n+|m|)!)
                    P_n^|m|(cos(theta)) exp(i m phi),
```

so `Y_0^0=1` and

```text
P_n(cos alpha) = sum_{m=-n}^n Y_n^{-m}(y) Y_n^m(x).
```

This is not SciPy's usual orthonormal normalization.

### 3-D Laplace

```text
M_n^m = sum_j rho_yj^n Y_n^{-m}(y_j) sigma_j,
u(x) = sum_n sum_m M_n^m Y_n^m(x)/rho_x^(n+1),

L_n^m = sum_j Y_n^{-m}(y_j) sigma_j/rho_yj^(n+1),
u(x) = sum_n sum_m L_n^m rho_x^n Y_n^m(x).
```

The finite multipole remainder is bounded by

```text
A/[sqrt(1-L^2) R (c_tilde-1)] * c_tilde^(-P).
```

The preprint describes direct `O(P^4)` translations and an `O(P^3)`
point-and-shoot scheme: complex rotations align the displacement with the
z-axis, a coaxial translation is applied, then rotations are reversed. Rotation
about z is diagonal; rotation about y uses analytically continued Wigner-d
matrices or the FFT recovery in eq. `mp_y_rot`.

### 3-D Helmholtz

For the stated kernel `exp(i k rho)/rho`, the validated expansion is

```text
u(x) = i k sum_n sum_m M_n^m h_n^(1)(k rho_x) Y_n^m(x),
M_n^m = (2n+1) sum_j j_n(k rho_yj) Y_n^{-m}(y_j) sigma_j,
```

and analogously for local coefficients with `h_n` at sources and `j_n` at
targets. The implementation intentionally includes the `i k` factor: since
`h_0^(1)(z)=-i exp(iz)/z`, the displayed preprint expansion without it does not
equal the stated kernel. Direct numerical and mpmath tests validate the scale.
The implementation also omits the preprint's printed `(-1)^n` in the direct
local coefficients; the standard addition theorem and direct numerical tests
show that sign is inconsistent with the paper's own coordinate convention.

## 7. Adaptive algorithm

The paper's level-restricted tree uses four classical adaptive interaction
lists:

1. List 1: adjacent leaf interactions, evaluated directly.
2. List 2: well-separated children of parent colleagues, handled by M2L.
3. List 3: smaller descendants of colleagues, handled by M2P.
4. List 4: reverse List 3 relation, handled by P2L.

Then: P2M at leaves; upward M2M; List 1 direct; List 2 M2L; List 3 M2P;
List 4 P2L; downward L2L; local evaluation.

The reference implementation uses an equivalent dual-tree traversal rather than
materializing Lists 1–4. A source/target box pair is accepted only by the exact
two-channel test above; otherwise the larger nonleaf box is split, and a pair of
leaves is direct. Accepted local expansions are propagated down by L2L. This is
simpler to audit and naturally handles unequal source/target trees. As with
other adaptive dual-tree FMMs, linear complexity assumes a balanced,
bounded-density geometry; pathological point distributions can produce deeper
or more interactions.

## 8. Choosing order and avoiding instability

At box width `w`, paper near radius is `sqrt(2)w/2` in 2-D or `sqrt(3)w/2` in
3-D, and far radius is `(k_sep+0.5)w`. Choose the smallest `P` meeting the
relevant bound. For Helmholtz substitute Bessel/Hankel radial basis products;
orders can vary with level and frequency.

The theoretically conservative geometry factors are
`((1+L)/(1-L))^P` in 2-D and `C_L^P` in 3-D (the preprint's displayed 3-D order
criterion writes the reciprocal, which conflicts with its preceding error
bounds). The numerical section often uses classical real-coordinate orders,
but that is empirical, not guaranteed.

Observed paper limits:

- 3-D Helmholtz with one-box near separation can catastrophically cancel beyond
  roughly 25 wavelengths; two-box separation was stable to roughly 50.
- 2-D Helmholtz showed cancellation beyond roughly 150 wavelengths.
- Production wideband FMMs normally switch formulations around a 16-wavelength
  root box.

Increase near separation, order, and/or arithmetic precision. The package's
`high_precision` module supplies input-preserving mpmath direct oracles for
branch and cancellation diagnosis. They return object arrays of `mpmath.mpc`
values so results are not silently rounded back to binary64. This does not
pretend an arbitrary-precision O(N^2) reference is a fast solver.

## 9. Verification checklist

- Confirm points are samples of a common Lipschitz graph and estimate `L`.
- Use bilinear radii; never replace them with `numpy.linalg.norm` on complex
  coordinates.
- Fix one square-root/log branch and test continuity over the geometry.
- Check both 2-D characteristic channels for every accepted M2L pair.
- Compare P2M, M2M, M2L, L2L, and evaluations independently against direct sums.
- Increase `P` and verify geometric convergence before relying on a result.
- At high frequency, compare against mpmath and monitor coefficient growth for
  cancellation.
- Apply physical Green-function constants exactly once.
