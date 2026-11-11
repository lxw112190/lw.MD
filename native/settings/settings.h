#pragma once

#include "common/dpi.h"
#include <nlohmann/json_fwd.hpp>
#include <optional>

struct SavedWindowState {
  int left = 0;
  int top = 0;
  int width = 1180;
  int height = 760;
  bool maximized = false;
  int dpi = kDefaultDpi;
};

nlohmann::json LoadSettings();
void SaveSettings(const nlohmann::json& value);
const wchar_t* UiText(const wchar_t* chinese, const wchar_t* english);
const char* DefaultUiLanguage(unsigned short system_language, bool existing_settings);
std::optional<SavedWindowState> LoadWindowState(const nlohmann::json& settings);
std::optional<SavedWindowState> LoadWindowState();
nlohmann::json SaveWindowState(nlohmann::json settings,
                               const SavedWindowState& state);
void SaveWindowState(const SavedWindowState& state);
