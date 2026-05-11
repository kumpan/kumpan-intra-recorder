export const IpcChannel = {
  GetSettings: "settings:get",
  SetSettings: "settings:set",
  HasToken: "settings:has-token",
  TestToken: "settings:test-token",
  OpenSettings: "window:open-settings",

  RecorderStart: "recorder:start",
  RecorderChunk: "recorder:chunk",
  RecorderFinish: "recorder:finish",
  RecorderAbort: "recorder:abort",
  RecorderFailed: "recorder:failed",

  RecorderCommandStart: "recorder:cmd-start",
  RecorderCommandStop: "recorder:cmd-stop",
  RecorderStateChanged: "recorder:state-changed",

  HandoffGetPending: "handoff:get-pending",
  HandoffUpload: "handoff:upload",
  HandoffSaveLocally: "handoff:save-locally",
  HandoffDiscard: "handoff:discard",
  HandoffUploadProgress: "handoff:upload-progress",
  HandoffCloseWindow: "handoff:close-window",

  OpenExternal: "shell:open-external",
  ResetScreenRecording: "permissions:reset-screen-recording",
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]
