#include "app/main_window.h"
#include <Windows.h>
#include <Ole2.h>
int WINAPI wWinMain(HINSTANCE instance, HINSTANCE, PWSTR, int) {
  const auto initialized = OleInitialize(nullptr);
  const int result = RunMainWindow(instance);
  if (SUCCEEDED(initialized)) OleUninitialize();
  return result;
}
