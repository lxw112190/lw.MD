#include "settings/settings.h"

#include "filesystem/file_service.h"

#include <ShlObj.h>
#include <filesystem>
#include <nlohmann/json.hpp>
#include <stdexcept>

using json = nlohmann::json;

namespace {
constexpr int kMaximumPersistedDpi = 480;

std::filesystem::path SettingsPath() {
  PWSTR local_app_data = nullptr;
  if (FAILED(SHGetKnownFolderPath(FOLDERID_LocalAppData, KF_FLAG_CREATE, nullptr,
                                  &local_app_data))) {
    throw std::runtime_error("Cannot locate local application data");
  }
  const std::filesystem::path root(local_app_data);
  CoTaskMemFree(local_app_data);
  const auto directory = root / L"lw.MD";
  std::filesystem::create_directories(directory);
  return directory / L"settings.json";
}

json Defaults(bool first_run = false) {
  return {{"language", DefaultUiLanguage(GetUserDefaultUILanguage(), !first_run)},
          {"theme", "system"},
          {"outlineVisible", true},
          {"outlineWidth", 280},
          {"recentFiles", json::array()},
          {"editorMode", "ir"}};
}

json Normalize(const json& input) {
  auto result = Defaults();
  if (input.contains("language") && input["language"].is_string() &&
      input["language"] == "en_US") result["language"] = "en_US";
  const auto theme = input.value("theme", "system");
  if (theme == "system" || theme == "light" || theme == "dark") {
    result["theme"] = theme;
  }
  result["outlineVisible"] = input.value("outlineVisible", true);
  const auto outline_width = input.find("outlineWidth");
  if (outline_width != input.end() && outline_width->is_number_integer() &&
      *outline_width >= 180 && *outline_width <= 420) {
    result["outlineWidth"] = outline_width->get<int>();
  }
  const auto editor_mode = input.value("editorMode", "ir");
  result["editorMode"] = editor_mode == "sv" ? "sv" : "ir";
  if (input.contains("recentFiles") && input["recentFiles"].is_array()) {
    auto& files = result["recentFiles"];
    for (const auto& item : input["recentFiles"]) {
      if (!item.is_string() || files.size() >= 10) continue;
      const auto path = item.get<std::string>();
      if (!path.empty()) files.push_back(path);
    }
  }
  if (input.contains("window") && input["window"].is_object()) {
    const auto& window = input["window"];
    const auto width = window.value("width", 0);
    const auto height = window.value("height", 0);
    if (width >= 640 && width <= 16384 && height >= 480 && height <= 16384) {
      auto dpi = kDefaultDpi;
      const auto dpi_value = window.find("dpi");
      if (dpi_value != window.end() && dpi_value->is_number_integer()) {
        const auto candidate = dpi_value->get<int>();
        if (candidate >= kDefaultDpi && candidate <= kMaximumPersistedDpi) {
          dpi = candidate;
        }
      }
      result["window"] = {{"left", window.value("left", 0)},
                          {"top", window.value("top", 0)},
                          {"width", width},
                          {"height", height},
                          {"maximized", window.value("maximized", false)},
                          {"dpi", dpi}};
    }
  }
  return result;
}
}  // namespace

json LoadSettings() {
  const auto path = SettingsPath();
  if (!std::filesystem::exists(path)) return Defaults(true);
  try {
    return Normalize(json::parse(ReadUtf8File(path.wstring())));
  } catch (...) {
    return Defaults();
  }
}

void SaveSettings(const json& value) {
  auto normalized = Normalize(value);
  if (!value.contains("window")) {
    const auto existing = LoadSettings();
    if (existing.contains("window")) normalized["window"] = existing["window"];
  }
  WriteUtf8FileAtomically(SettingsPath().wstring(), normalized.dump(2));
}

const wchar_t* UiText(const wchar_t* chinese, const wchar_t* english) {
  try { return LoadSettings().value("language", "zh_CN") == "en_US" ? english : chinese; }
  catch (...) { return chinese; }
}

const char* DefaultUiLanguage(unsigned short system_language, bool existing_settings) {
  return existing_settings || PRIMARYLANGID(system_language) == LANG_CHINESE ? "zh_CN" : "en_US";
}

std::optional<SavedWindowState> LoadWindowState(const json& settings) {
  if (!settings.contains("window")) return std::nullopt;
  const auto& window = settings["window"];
  return SavedWindowState{window.value("left", 0),
                          window.value("top", 0),
                          window.value("width", 1180),
                          window.value("height", 760),
                          window.value("maximized", false),
                          window.value("dpi", kDefaultDpi)};
}

std::optional<SavedWindowState> LoadWindowState() {
  return LoadWindowState(LoadSettings());
}

json SaveWindowState(json settings, const SavedWindowState& state) {
  settings["window"] = {{"left", state.left},
                        {"top", state.top},
                        {"width", state.width},
                        {"height", state.height},
                        {"maximized", state.maximized},
                        {"dpi", state.dpi}};
  return Normalize(settings);
}

void SaveWindowState(const SavedWindowState& state) {
  const auto settings = SaveWindowState(LoadSettings(), state);
  WriteUtf8FileAtomically(SettingsPath().wstring(), settings.dump(2));
}
