#pragma once

#include <Windows.h>

inline bool ApplyDpiSuggestedRect(HWND window, const RECT* suggested) {
  if (!window || !suggested) return false;
  return SetWindowPos(window, nullptr, suggested->left, suggested->top,
                      suggested->right - suggested->left,
                      suggested->bottom - suggested->top,
                      SWP_NOZORDER | SWP_NOACTIVATE) != FALSE;
}
