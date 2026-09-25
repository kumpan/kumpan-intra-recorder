export const IpcChannel = {
  GetSettings: "settings:get",
  SetSettings: "settings:set",
  HasToken: "settings:has-token",
  TestToken: "settings:test-token",

  RecorderStart: "recorder:start",
  RecorderChunk: "recorder:chunk",
  RecorderFinish: "recorder:finish",
  RecorderAbort: "recorder:abort",
  RecorderFailed: "recorder:failed",
  RecorderAudioActivity: "recorder:audio-activity",

  RecorderCommandStart: "recorder:cmd-start",
  RecorderCommandStop: "recorder:cmd-stop",
  RecorderStateChanged: "recorder:state-changed",

  HandoffGetPending: "handoff:get-pending",
  HandoffUpload: "handoff:upload",
  HandoffSaveLocally: "handoff:save-locally",
  HandoffDiscard: "handoff:discard",
  HandoffUploadProgress: "handoff:upload-progress",

  PanelGetState: "panel:get-state",
  PanelStateChanged: "panel:state-changed",
  PanelResize: "panel:resize",
  PanelStartRecording: "panel:start-recording",
  PanelStopRecording: "panel:stop-recording",
  PanelCheckForUpdates: "panel:check-for-updates",
  PanelInstallUpdate: "panel:install-update",
  PanelQuit: "panel:quit",

  MeetingBannerContext: "meeting:banner-context",
  MeetingBannerUpdate: "meeting:banner-update",
  MeetingBannerAccept: "meeting:banner-accept",
  MeetingBannerDismiss: "meeting:banner-dismiss",

  OpenExternal: "shell:open-external",
  ResetScreenRecording: "permissions:reset-screen-recording",
} as const

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel]
