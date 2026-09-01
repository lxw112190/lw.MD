#include "filesystem/file_revision.h"

#include <Windows.h>
#include <bcrypt.h>

#include <filesystem>
#include <fstream>
#include <iomanip>
#include <sstream>
#include <stdexcept>
#include <vector>

namespace {
std::uint64_t FileTimeValue(const FILETIME& value) {
  ULARGE_INTEGER combined{};
  combined.LowPart = value.dwLowDateTime;
  combined.HighPart = value.dwHighDateTime;
  return combined.QuadPart;
}

class Sha256Hasher {
 public:
  Sha256Hasher() {
    if (BCryptOpenAlgorithmProvider(&algorithm_, BCRYPT_SHA256_ALGORITHM,
                                    nullptr, 0) != 0 ||
        BCryptGetProperty(algorithm_, BCRYPT_OBJECT_LENGTH,
                          reinterpret_cast<PUCHAR>(&object_length_),
                          sizeof(object_length_), &property_length_, 0) != 0 ||
        BCryptGetProperty(algorithm_, BCRYPT_HASH_LENGTH,
                          reinterpret_cast<PUCHAR>(&hash_length_),
                          sizeof(hash_length_), &property_length_, 0) != 0 ||
        hash_length_ != 32U) {
      throw std::runtime_error("Unable to initialize SHA-256");
    }
    object_.resize(object_length_);
    if (BCryptCreateHash(algorithm_, &hash_, object_.data(), object_length_,
                         nullptr, 0, 0) != 0) {
      throw std::runtime_error("Unable to create SHA-256 hash");
    }
  }

  Sha256Hasher(const Sha256Hasher&) = delete;
  Sha256Hasher& operator=(const Sha256Hasher&) = delete;

  ~Sha256Hasher() {
    if (hash_) BCryptDestroyHash(hash_);
    if (algorithm_) BCryptCloseAlgorithmProvider(algorithm_, 0);
  }

  std::array<std::uint8_t, 32> Finish() {
    std::array<std::uint8_t, 32> result{};
    if (BCryptFinishHash(hash_, result.data(), static_cast<ULONG>(result.size()),
                         0) != 0) {
      throw std::runtime_error("Unable to finish SHA-256 hash");
    }
    return result;
  }

  void Update(const char* bytes, std::size_t size) {
    if (size > 0 && BCryptHashData(hash_, reinterpret_cast<PUCHAR>(const_cast<char*>(bytes)),
                                   static_cast<ULONG>(size), 0) != 0) {
      throw std::runtime_error("Unable to calculate SHA-256 hash");
    }
  }

 private:
  BCRYPT_ALG_HANDLE algorithm_ = nullptr;
  BCRYPT_HASH_HANDLE hash_ = nullptr;
  ULONG object_length_ = 0;
  ULONG hash_length_ = 0;
  ULONG property_length_ = 0;
  std::vector<std::uint8_t> object_;
};
}  // namespace

FileRevision GetFileRevision(const std::wstring& path) {
  WIN32_FILE_ATTRIBUTE_DATA attributes{};
  if (!GetFileAttributesExW(path.c_str(), GetFileExInfoStandard, &attributes) ||
      (attributes.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) != 0) {
    throw std::runtime_error("Unable to inspect file revision");
  }

  FileRevision revision{};
  revision.size = (static_cast<std::uint64_t>(attributes.nFileSizeHigh) << 32U) |
                  attributes.nFileSizeLow;
  revision.last_write_time = FileTimeValue(attributes.ftLastWriteTime);

  std::ifstream input(std::filesystem::path(path), std::ios::binary);
  if (!input) throw std::runtime_error("Unable to read file revision");
  Sha256Hasher hasher;
  std::array<char, 64U * 1024U> buffer{};
  while (input) {
    input.read(buffer.data(), static_cast<std::streamsize>(buffer.size()));
    const auto count = input.gcount();
    if (count > 0) hasher.Update(buffer.data(), static_cast<std::size_t>(count));
  }
  if (!input.eof()) throw std::runtime_error("Unable to read file revision");
  revision.sha256 = hasher.Finish();
  return revision;
}

bool SameFileContent(const FileRevision& left, const FileRevision& right) {
  return left.sha256 == right.sha256;
}

std::string FileRevisionHashHex(const FileRevision& revision) {
  std::ostringstream output;
  output << std::hex << std::setfill('0');
  for (const auto byte : revision.sha256) output << std::setw(2) << static_cast<int>(byte);
  return output.str();
}
