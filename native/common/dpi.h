#pragma once

#include <Windows.h>

constexpr int kDefaultDpi = 96;

inline int ScaleDpiValue(const int value, const int from_dpi, const int to_dpi) {
  if (from_dpi <= 0 || to_dpi <= 0) return value;
  return MulDiv(value, to_dpi, from_dpi);
}
