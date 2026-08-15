"""Complex-coordinate FMM reference implementation for arXiv:2509.05458."""

from .coordinates import (
    complex_radius,
    empirical_lipschitz_constant,
    spherical_harmonic,
)
from .fmm import FMMResult, FMMStats, evaluate_fmm_2d
from .high_precision import direct_sum_2d_mp, direct_sum_3d_mp
from .three_dimensional import (
    direct_sum_3d,
    helmholtz_p2l_3d,
    helmholtz_p2m_3d,
    laplace_p2l_3d,
    laplace_p2m_3d,
)
from .two_dimensional import direct_sum_2d

__all__ = [
    "FMMResult",
    "FMMStats",
    "complex_radius",
    "direct_sum_2d",
    "direct_sum_2d_mp",
    "direct_sum_3d",
    "direct_sum_3d_mp",
    "empirical_lipschitz_constant",
    "evaluate_fmm_2d",
    "helmholtz_p2l_3d",
    "helmholtz_p2m_3d",
    "laplace_p2l_3d",
    "laplace_p2m_3d",
    "spherical_harmonic",
]
