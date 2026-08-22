#include "associations/file_association.h"

#include <Shellapi.h>
#include <ShlObj.h>

#include <array>
#include <optional>
#include <stdexcept>
#include <vector>

namespace {
constexpr wchar_t kApplicationKey[] =
    L"Software\\Classes\\Applications\\lw.MD.exe";
constexpr wchar_t kProgId[] = L"lw.MD.Markdown";
constexpr wchar_t kProgIdKey[] = L"Software\\Classes\\lw.MD.Markdown";
constexpr wchar_t kRegisteredApplicationsKey[] =
    L"Software\\RegisteredApplications";
constexpr wchar_t kCapabilitiesPath[] = L"Software\\lw.MD\\Capabilities";
constexpr wchar_t kCapabilitiesKey[] = L"Software\\lw.MD\\Capabilities";
constexpr std::array<const wchar_t*, 2> kExtensions{L".md", L".markdown"};

std::wstring Join(const std::wstring& left, const std::wstring& right) {
  return left + L"\\" + right;
}

std::wstring ClassesKey(const std::wstring& relative) {
  return L"Software\\Classes\\" + relative;
}

std::wstring CurrentExecutablePath() {
  std::vector<wchar_t> buffer(1024U);
  while (buffer.size() <= 32768U) {
    const auto length = GetModuleFileNameW(
        nullptr, buffer.data(), static_cast<DWORD>(buffer.size()));
    if (length == 0) throw std::runtime_error("无法获取 lw.MD.exe 路径");
    if (length < buffer.size() - 1U) {
      return std::wstring(buffer.data(), length);
    }
    buffer.resize(buffer.size() * 2U);
  }
  throw std::runtime_error("lw.MD.exe 路径过长");
}

void ThrowRegistryError(const LONG result) {
  if (result != ERROR_SUCCESS) {
    throw std::runtime_error("无法更新 Windows 文件关联");
  }
}

void SetStringValue(const std::wstring& subkey, const wchar_t* name,
                    const std::wstring& value) {
  HKEY key = nullptr;
  ThrowRegistryError(RegCreateKeyExW(HKEY_CURRENT_USER, subkey.c_str(), 0,
                                     nullptr, REG_OPTION_NON_VOLATILE,
                                     KEY_SET_VALUE, nullptr, &key, nullptr));
  const auto bytes = static_cast<DWORD>((value.size() + 1U) * sizeof(wchar_t));
  const auto result = RegSetValueExW(
      key, name, 0, REG_SZ,
      reinterpret_cast<const BYTE*>(value.c_str()), bytes);
  RegCloseKey(key);
  ThrowRegistryError(result);
}

void SetNoneValue(const std::wstring& subkey, const wchar_t* name) {
  HKEY key = nullptr;
  ThrowRegistryError(RegCreateKeyExW(HKEY_CURRENT_USER, subkey.c_str(), 0,
                                     nullptr, REG_OPTION_NON_VOLATILE,
                                     KEY_SET_VALUE, nullptr, &key, nullptr));
  const auto result = RegSetValueExW(key, name, 0, REG_NONE, nullptr, 0);
  RegCloseKey(key);
  ThrowRegistryError(result);
}

std::optional<std::wstring> ReadStringValue(const std::wstring& subkey,
                                            const wchar_t* name) {
  HKEY key = nullptr;
  if (RegOpenKeyExW(HKEY_CURRENT_USER, subkey.c_str(), 0, KEY_QUERY_VALUE,
                    &key) != ERROR_SUCCESS) {
    return std::nullopt;
  }
  DWORD type = 0;
  DWORD bytes = 0;
  auto result = RegQueryValueExW(key, name, nullptr, &type, nullptr, &bytes);
  if (result != ERROR_SUCCESS ||
      (type != REG_SZ && type != REG_EXPAND_SZ) || bytes < sizeof(wchar_t)) {
    RegCloseKey(key);
    return std::nullopt;
  }
  std::vector<wchar_t> value(bytes / sizeof(wchar_t) + 1U, L'\0');
  result = RegQueryValueExW(key, name, nullptr, &type,
                            reinterpret_cast<BYTE*>(value.data()), &bytes);
  RegCloseKey(key);
  if (result != ERROR_SUCCESS) return std::nullopt;
  return std::wstring(value.data());
}

bool ValueExists(const std::wstring& subkey, const wchar_t* name) {
  HKEY key = nullptr;
  if (RegOpenKeyExW(HKEY_CURRENT_USER, subkey.c_str(), 0, KEY_QUERY_VALUE,
                    &key) != ERROR_SUCCESS) {
    return false;
  }
  const auto result = RegQueryValueExW(key, name, nullptr, nullptr, nullptr,
                                       nullptr);
  RegCloseKey(key);
  return result == ERROR_SUCCESS;
}

bool SameText(const std::optional<std::wstring>& value,
              const std::wstring& expected) {
  return value && _wcsicmp(value->c_str(), expected.c_str()) == 0;
}

void DeleteTree(const std::wstring& subkey) {
  const auto result = RegDeleteTreeW(HKEY_CURRENT_USER, subkey.c_str());
  if (result != ERROR_SUCCESS && result != ERROR_FILE_NOT_FOUND &&
      result != ERROR_PATH_NOT_FOUND) {
    ThrowRegistryError(result);
  }
}

void DeleteValue(const std::wstring& subkey, const wchar_t* name) {
  HKEY key = nullptr;
  const auto opened = RegOpenKeyExW(HKEY_CURRENT_USER, subkey.c_str(), 0,
                                    KEY_SET_VALUE, &key);
  if (opened == ERROR_FILE_NOT_FOUND || opened == ERROR_PATH_NOT_FOUND) return;
  ThrowRegistryError(opened);
  const auto result = RegDeleteValueW(key, name);
  RegCloseKey(key);
  if (result != ERROR_SUCCESS && result != ERROR_FILE_NOT_FOUND) {
    ThrowRegistryError(result);
  }
}

void DeleteKeyIfEmpty(const std::wstring& subkey) {
  const auto result = RegDeleteKeyW(HKEY_CURRENT_USER, subkey.c_str());
  if (result != ERROR_SUCCESS && result != ERROR_FILE_NOT_FOUND &&
      result != ERROR_PATH_NOT_FOUND && result != ERROR_ACCESS_DENIED) {
    ThrowRegistryError(result);
  }
}

std::wstring ExtractExecutablePath(const std::wstring& command) {
  if (command.empty()) return L"";
  if (command.front() == L'\"') {
    const auto end = command.find(L'\"', 1U);
    return end == std::wstring::npos ? L"" : command.substr(1U, end - 1U);
  }
  const auto end = command.find(L' ');
  return command.substr(0U, end);
}

std::wstring ApplicationCommandKey() {
  return Join(Join(kApplicationKey, L"shell"), L"open\\command");
}

std::wstring ProgIdCommandKey() {
  return Join(Join(kProgIdKey, L"shell"), L"open\\command");
}

std::wstring RightClickVerbKey(const wchar_t* extension) {
  return ClassesKey(L"SystemFileAssociations\\" + std::wstring(extension) +
                    L"\\shell\\lwMD");
}

std::wstring RightClickCommandKey(const wchar_t* extension) {
  return Join(RightClickVerbKey(extension), L"command");
}

std::wstring OpenWithProgIdsKey(const wchar_t* extension) {
  return ClassesKey(std::wstring(extension) + L"\\OpenWithProgids");
}

std::wstring CapabilitiesAssociationsKey() {
  return Join(kCapabilitiesKey, L"FileAssociations");
}

void NotifyAssociationChanged() {
  SHChangeNotify(SHCNE_ASSOCCHANGED, SHCNF_IDLIST, nullptr, nullptr);
}
}  // namespace

std::wstring BuildAssociationOpenCommand(
    const std::wstring& executable_path) {
  return L"\"" + executable_path + L"\" \"%1\"";
}

FileAssociationStatus GetMarkdownFileAssociationStatus() {
  FileAssociationStatus status;
  status.executable_path = CurrentExecutablePath();
  const auto expected_command =
      BuildAssociationOpenCommand(status.executable_path);
  const auto prog_id_command = ReadStringValue(ProgIdCommandKey(), nullptr);
  const auto application_command =
      ReadStringValue(ApplicationCommandKey(), nullptr);
  status.registered = prog_id_command.has_value() ||
                      application_command.has_value();
  if (prog_id_command) {
    status.registered_executable_path =
        ExtractExecutablePath(*prog_id_command);
  } else if (application_command) {
    status.registered_executable_path =
        ExtractExecutablePath(*application_command);
  }

  bool complete = SameText(prog_id_command, expected_command) &&
                  SameText(application_command, expected_command) &&
                  SameText(ReadStringValue(kRegisteredApplicationsKey,
                                           L"lw.MD"),
                           kCapabilitiesPath);
  for (const auto* extension : kExtensions) {
    complete = complete &&
               ValueExists(OpenWithProgIdsKey(extension), kProgId) &&
               SameText(ReadStringValue(RightClickCommandKey(extension),
                                        nullptr),
                        expected_command) &&
               SameText(ReadStringValue(CapabilitiesAssociationsKey(),
                                        extension),
                        kProgId);
  }
  status.current = status.registered && complete;
  return status;
}

void RegisterMarkdownFileAssociations() {
  const auto executable = CurrentExecutablePath();
  const auto command = BuildAssociationOpenCommand(executable);
  const auto icon = L"\"" + executable + L"\",0";

  SetStringValue(kApplicationKey, L"FriendlyAppName", L"lw.MD 简墨");
  SetStringValue(Join(kApplicationKey, L"DefaultIcon"), nullptr, icon);
  for (const auto* extension : kExtensions) {
    SetStringValue(Join(kApplicationKey, L"SupportedTypes"), extension, L"");
  }
  SetStringValue(ApplicationCommandKey(), nullptr, command);

  SetStringValue(kProgIdKey, nullptr, L"lw.MD Markdown 文档");
  SetStringValue(Join(kProgIdKey, L"DefaultIcon"), nullptr, icon);
  SetStringValue(ProgIdCommandKey(), nullptr, command);

  for (const auto* extension : kExtensions) {
    SetNoneValue(OpenWithProgIdsKey(extension), kProgId);
    const auto verb = RightClickVerbKey(extension);
    SetStringValue(verb, L"MUIVerb", L"使用 lw.MD 打开");
    SetStringValue(verb, L"Icon", icon);
    SetStringValue(verb, L"MultiSelectModel", L"Single");
    SetStringValue(RightClickCommandKey(extension), nullptr, command);
  }

  SetStringValue(kCapabilitiesKey, L"ApplicationName", L"lw.MD 简墨");
  SetStringValue(kCapabilitiesKey, L"ApplicationDescription",
                 L"简洁轻量的本地 Markdown 编辑器");
  for (const auto* extension : kExtensions) {
    SetStringValue(CapabilitiesAssociationsKey(), extension, kProgId);
  }
  SetStringValue(kRegisteredApplicationsKey, L"lw.MD", kCapabilitiesPath);
  NotifyAssociationChanged();
}

void UnregisterMarkdownFileAssociations() {
  DeleteTree(kApplicationKey);
  DeleteTree(kProgIdKey);
  for (const auto* extension : kExtensions) {
    DeleteValue(OpenWithProgIdsKey(extension), kProgId);
    DeleteTree(RightClickVerbKey(extension));
    DeleteKeyIfEmpty(OpenWithProgIdsKey(extension));
  }
  DeleteValue(kRegisteredApplicationsKey, L"lw.MD");
  DeleteTree(kCapabilitiesKey);
  DeleteKeyIfEmpty(L"Software\\lw.MD");
  NotifyAssociationChanged();
}

bool OpenDefaultAppsSettings(HWND owner) {
  const auto result = reinterpret_cast<INT_PTR>(ShellExecuteW(
      owner, L"open", L"ms-settings:defaultapps?registeredAppUser=lw.MD",
      nullptr, nullptr, SW_SHOWNORMAL));
  return result > 32;
}

