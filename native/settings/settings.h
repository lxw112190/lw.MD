#pragma once

#include <nlohmann/json_fwd.hpp>
#include <optional>

struct SavedWindowState {
  int left = 0;
  int top = 0;
  int width = 1180;
  int height = 760;
  bool maximized = false;
};

nlohmann::json LoadSettings();
void SaveSettings(const nlohmann::json& value);
std::optional<SavedWindowState> LoadWindowState();
void SaveWindowState(const SavedWindowState& state);
