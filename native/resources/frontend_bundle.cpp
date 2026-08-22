#include "resources/frontend_bundle.h"

#include "common/utf8.h"

#include <ShlObj.h>
#include <Windows.h>
#include <miniz.h>

#include <cstdint>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <string>

namespace {
constexpr int kFrontendResourceId = 101;

std::filesystem::path FrontendCacheRoot() {
  PWSTR local_app_data = nullptr;
  if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr,
                                  &local_app_data))) {
    throw std::runtime_error("Cannot locate local application data");
  }
  const std::filesystem::path root(local_app_data);
  CoTaskMemFree(local_app_data);
  return root / L"lw.MD" / L"frontend";
}

std::string PayloadHash(const std::uint8_t* bytes, std::size_t size) {
  std::uint64_t value = 1469598103934665603ULL;
  for (std::size_t index = 0; index < size; ++index) {
    value ^= bytes[index];
    value *= 1099511628211ULL;
  }
  std::ostringstream output;
  output << std::hex << std::setw(16) << std::setfill('0') << value;
  return output.str();
}

bool IsSafeRelativePath(const std::filesystem::path& path) {
  if (path.empty() || path.is_absolute() || path.has_root_name()) return false;
  for (const auto& part : path) {
    if (part == L"..") return false;
  }
  return true;
}

void ExtractZip(const std::uint8_t* bytes, std::size_t size,
                const std::filesystem::path& destination) {
  mz_zip_archive archive{};
  if (!mz_zip_reader_init_mem(&archive, bytes, size, 0)) {
    throw std::runtime_error("Embedded frontend ZIP is invalid");
  }
  try {
    const auto count = mz_zip_reader_get_num_files(&archive);
    for (mz_uint index = 0; index < count; ++index) {
      mz_zip_archive_file_stat stat{};
      if (!mz_zip_reader_file_stat(&archive, index, &stat)) {
        throw std::runtime_error("Cannot inspect embedded frontend entry");
      }
      const auto relative = std::filesystem::path(Utf8ToWide(stat.m_filename)).lexically_normal();
      if (!IsSafeRelativePath(relative)) {
        throw std::runtime_error("Unsafe path in embedded frontend ZIP");
      }
      const auto output = destination / relative;
      if (stat.m_is_directory) {
        std::filesystem::create_directories(output);
        continue;
      }
      std::filesystem::create_directories(output.parent_path());
      size_t extracted_size = 0;
      void* extracted = mz_zip_reader_extract_to_heap(&archive, index, &extracted_size, 0);
      if (!extracted && extracted_size != 0) {
        throw std::runtime_error("Cannot extract embedded frontend entry");
      }
      std::ofstream file(output, std::ios::binary | std::ios::trunc);
      if (!file) {
        mz_free(extracted);
        throw std::runtime_error("Cannot create frontend cache file");
      }
      if (extracted_size != 0) {
        file.write(static_cast<const char*>(extracted),
                   static_cast<std::streamsize>(extracted_size));
      }
      mz_free(extracted);
      if (!file) throw std::runtime_error("Cannot write frontend cache file");
    }
  } catch (...) {
    mz_zip_reader_end(&archive);
    throw;
  }
  mz_zip_reader_end(&archive);
}
}  // namespace

std::filesystem::path ExtractBundledFrontend() {
  const auto module = GetModuleHandleW(nullptr);
  const auto resource = FindResourceW(module, MAKEINTRESOURCEW(kFrontendResourceId), RT_RCDATA);
  if (!resource) throw std::runtime_error("Embedded frontend resource is missing");
  const auto loaded = LoadResource(module, resource);
  const auto size = static_cast<std::size_t>(SizeofResource(module, resource));
  const auto* bytes = static_cast<const std::uint8_t*>(LockResource(loaded));
  if (!loaded || !bytes || size == 0) {
    throw std::runtime_error("Embedded frontend resource is empty");
  }

  const auto cache_root = FrontendCacheRoot();
  std::filesystem::create_directories(cache_root);
  const auto hash = Utf8ToWide(PayloadHash(bytes, size));
  const auto destination = cache_root / hash;
  if (std::filesystem::exists(destination / L"index.html")) return destination;

  const auto temporary = cache_root / (hash + L".tmp-" + std::to_wstring(GetCurrentProcessId()));
  std::error_code error;
  std::filesystem::remove_all(temporary, error);
  std::filesystem::create_directories(temporary);
  try {
    ExtractZip(bytes, size, temporary);
    if (!std::filesystem::exists(temporary / L"index.html")) {
      throw std::runtime_error("Embedded frontend does not contain index.html");
    }
    std::filesystem::rename(temporary, destination, error);
    if (error) {
      if (!std::filesystem::exists(destination / L"index.html")) {
        throw std::runtime_error("Cannot publish frontend cache");
      }
      std::filesystem::remove_all(temporary, error);
    }
  } catch (...) {
    std::filesystem::remove_all(temporary, error);
    throw;
  }
  return destination;
}
