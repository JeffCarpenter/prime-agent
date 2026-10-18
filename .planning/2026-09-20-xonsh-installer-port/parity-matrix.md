# Installer Parity Matrix

Audit of every function definition in `install.sh` against `scripts/install.xsh`. `install.sh` remains unchanged and release-facing. Shell helpers that Xonsh combines into object methods are listed against their owning method. The source currently contains 114 shell function definitions (the plan’s earlier 115 count was stale).

## Mapping

| `install.sh` function | Xonsh implementation |
|---|---|
| `main` | `main` |
| `prime_agent_install_node` | `install_node` |
| `create_temp_dir` | `temp_dir` |
| `prime_agent_is_loopback_test_base_url` | `is_loopback_test_base_url` |
| `prime_agent_validate_download_base_url` | `validate_download_base_url` |
| `prime_agent_curl_download` | `curl_download` |
| `prime_agent_install_traps` | `register_traps` |
| `prime_agent_cleanup` | `cleanup` |
| `prime_agent_signal_cleanup` | `signal_cleanup` |
| `prime_agent_restore_terminal` | `restore_terminal` |
| `prime_agent_init_screen` | `init_screen` |
| `prime_agent_read_terminal_size` | `read_terminal_size` |
| `prime_agent_screen` | `screen_update` |
| `prime_agent_init_screen_layout` | `init_screen_layout` |
| `prime_agent_refresh_screen_layout_mode` | `refresh_screen_layout_mode` |
| `prime_agent_terminal_size_supports_logo` | `terminal_supports_logo` |
| `prime_agent_lab_width_for_cols` | `lab_width_for_cols` |
| `prime_agent_render_screen` | `render_screen` |
| `prime_agent_content_height` | `content_height` |
| `prime_agent_show_logo` | `show_logo` |
| `prime_agent_content_line` | `content_line` |
| `prime_agent_screen_primary_text` | `screen_primary_text` |
| `prime_agent_set_lab_line` | `lab_line` |
| `prime_agent_logo_line` | `logo_line` |
| `prime_agent_lab_background_range` | `lab_background` |
| `prime_agent_lab_cell` | `lab_cell` |
| `prime_agent_set_blank_line` | `content_line` |
| `prime_agent_set_text_line` | `content_line` |
| `prime_agent_set_title_line` | `title_line` |
| `prime_agent_style_prime_agent_title` | `style_prime_agent_title` |
| `prime_agent_fit_ascii` | `fit_ascii` |
| `prime_agent_print_centered_line` | `centered_line` |
| `prime_agent_place_prompt_cursor` | `place_prompt_cursor` |
| `prime_agent_pulse` | `pulse` |
| `prime_agent_animation_detail_count` | `animation_detail_count` |
| `prime_agent_animation_current_frame` | `Screen.frame + animation_status` |
| `prime_agent_animation_step_index` | `Screen.frame + animation_detail` |
| `prime_agent_static_progress_title` | `static_progress_title` |
| `prime_agent_animation_status` | `animation_status` |
| `prime_agent_animation_detail` | `animation_detail` |
| `prime_agent_run_quiet_with_animation` | `run_animation` |
| `prime_agent_run_quiet_with_animation_steps` | `run_animation` |
| `prime_agent_run_quiet_with_animation_command` | `run_animation` |
| `prime_agent_prompt_yes_no` | `prompt_yes_no` |
| `start_preflight_checks` | `start_preflight_checks` |
| `finish_preflight_checks` | `finish_preflight_checks` |
| `run_preflight_checks` | `run_preflight_checks` |
| `resolve_prime_agent_version` | `resolve_version` |
| `normalize_version` | `normalize_version` |
| `install_node_npm_interactive` | `install_node_interactive` |
| `detect_node_install_method` | `detect_node_install_method` |
| `apt_node_candidate_is_new_enough` | `apt_candidate_is_new_enough` |
| `apk_node_candidate_is_new_enough` | `apk_candidate_is_new_enough` |
| `node_version_string_is_new_enough` | `node_version_is_new_enough` |
| `install_node_npm` | `install_node` |
| `node_install_needs_sudo` | `node_install_needs_sudo` |
| `prepare_sudo_for_node_install` | `prepare_sudo` |
| `run_node_install_method` | `run_node_install_method` |
| `install_node_with_homebrew` | `install_node_homebrew` |
| `install_node_with_apt` | `install_node_apt` |
| `install_node_with_apk` | `install_node_apk` |
| `install_node_standalone` | `install_node_standalone` |
| `verify_node_standalone_download` | `verify_node_download` |
| `ensure_node_standalone_extract_tools` | `ensure_extract_tools` |
| `load_standalone_node` | `load_standalone_node` |
| `node_standalone_base_dir` | `node_standalone_base_dir` |
| `detect_node_binary_platform` | `node_binary_platform` |
| `detect_node_binary_arch` | `node_binary_arch` |
| `print_sudo_note` | `print_sudo_note` |
| `run_with_sudo` | `run_with_sudo` |
| `configure_standalone_node_path` | `configure_standalone_node_path` |
| `resolve_prime_agent_with_original_path` | `resolve_command_with_original_path` |
| `detect_shell_profile` | `detect_shell_profile` |
| `shell_profile_has_standalone_node_path` | `profile_has_node_path` |
| `prompt_add_standalone_node_path` | `configure_standalone_node_path` |
| `print_standalone_path_manual_instructions` | `print_manual_path_instructions` |
| `standalone_node_path_line` | `standalone_node_path_line` |
| `prime_agent_shell_quote` | `shell_quote` |
| `prime_agent_source_profile_command` | `source_profile_command` |
| `download_prime_agent_package` | `download_package` |
| `verify_prime_agent_package_checksum` | `verify_package_checksum` |
| `prime_agent_run_checksum_check` | `check_checksum` |
| `confirm_install` | `confirm_install` |
| `confirm_kernel_runtime_setup` | `confirm_kernel_setup` |
| `prime_agent_npm_requires_remote_policy` | `npm_requires_remote_policy` |
| `prime_agent_npm_install` | `npm_install` |
| `install_prime_agent_package` | `install_package` |
| `prime_agent_native_glibc` | `native_glibc` |
| `prime_agent_native_musl` | `native_musl` |
| `prime_agent_native_avx2` | `native_avx2` |
| `prime_agent_native_platform` | `native_platform` |
| `prime_agent_native_cleanup` | `native_cleanup` |
| `prime_agent_native_discard_adopted_root` | `native_adopted_root_is_removable` |
| `prime_agent_native_prepare_root` | `native_prepare_root` |
| `prime_agent_native_rollback` | `native_rollback` |
| `prime_agent_native_valid_target` | `native_parse_target` |
| `prime_agent_native_parse_target` | `native_parse_target` |
| `prime_agent_native_validate_asset` | `native_validate_archive` |
| `prime_agent_native_validate_release_metadata` | `native_validate_release_metadata` |
| `prime_agent_native_probe_timeout` | `native_probe_timeout` |
| `prime_agent_native_probe_missing_libstdcxx` | `native_probe` |
| `prime_agent_native_report_missing_libstdcxx` | `native_probe` |
| `prime_agent_native_verify_release_target` | `native_verify_release_target` |
| `prime_agent_native_sweep_orphan_stages` | `native_cleanup` |
| `prime_agent_native_release_in_use` | `native_release_in_use` |
| `prime_agent_native_prune_releases` | `native_prune_releases` |
| `prime_agent_native_recover_activation` | `native_recover_activation` |
| `prime_agent_native_check_public_link` | `native_check_public_command` |
| `prime_agent_native_validate_archive` | `native_validate_archive` |
| `prime_agent_native_atomic_link` | `native_atomic_link` |
| `prime_agent_native_activate` | `native_activate` |
| `prime_agent_release_is_node_only` | `release_is_node_only` |
| `prime_agent_install_native` | `install_native` |
| `prime_agent_native_configure_path` | `native_configure_path` |

## Behavior oracles

Focused offline coverage is in `scripts/install-xsh.test.xsh` (20 tests). The repo’s TypeScript installer suites are the compatibility oracles for process-level edge cases.

| Area | Xonsh offline coverage | TypeScript oracle |
|---|---|---|
| Dispatch and install policy | `test_main_backend_dispatch`, `test_invalid_install_method_is_rejected_before_side_effects`, `test_unconfigured_download_base_url_is_rejected_before_side_effects` | `native-installer.test.ts`
| Download security and version/checksum selection | `test_download_base_url_policy`, `test_curl_download_protocol_policy`, `test_install_native_from_offline_release_feed` | `native-installer.test.ts`
| Node detection, install, and PATH | `test_standalone_node_lookup_uses_managed_path` | `native-installer.test.ts`
| Native platform, target, archive, and metadata | `test_native_platform_classification`, `test_native_target_parsing_and_validation`, `test_native_validate_archive_member_policy`, `test_native_extract_release_metadata`, `test_node_only_manifest_detection` | `native-installer.test.ts`, `installer-release-format.test.ts`
| Root ownership, activation, recovery, rollback, pruning | `test_native_prepare_root_and_unactivated_cleanup`, `test_native_atomic_link_and_activation_journal`, `test_native_recover_activation_states`, `test_native_rollback_switches_managed_links` | `native-installer.test.ts`
| Public command and PATH configuration | `test_native_install_public_command_ownership`, `test_native_configure_path_idempotently` | `native-installer.test.ts`
| Process/probe failure handling | `test_native_probe_timeout_decimal_bounds` | `native-installer.test.ts`

## Audit result

- All 114 shell functions map to an Xonsh method or to behavior consolidated into an owning method; no unmapped definitions remain.
- The map is structural, not a claim of one test per helper. The listed tests cover observable workflows; parity gaps found during implementation are recorded in `progress.md`.
- No source change was needed for this audit. The test file remains untracked per the plan.
