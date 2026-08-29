#pragma once

#include <filesystem>

void CleanupStaleFrontendCaches(
    const std::filesystem::path& cache_root,
    const std::filesystem::path& current,
    std::filesystem::file_time_type now =
        std::filesystem::file_time_type::clock::now()) noexcept;
