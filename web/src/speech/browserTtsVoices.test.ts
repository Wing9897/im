import { describe, expect, it } from "vitest";
import {
  normalizeTtsVoiceUri,
  speechLangMatchesVoice,
  toBrowserTtsVoiceOptions,
} from "./browserTtsVoices";
import { ttsSpeakOptionsFromVoiceSettings } from "./voiceSettings";

describe("browserTtsVoices", () => {
  it("matches speech language to voice lang prefixes", () => {
    expect(speechLangMatchesVoice("zh-HK", "zh-HK")).toBe(true);
    expect(speechLangMatchesVoice("zh-HK", "zh-CN")).toBe(true);
    expect(speechLangMatchesVoice("en-US", "en-GB")).toBe(true);
    expect(speechLangMatchesVoice("en-US", "de-DE")).toBe(false);
  });

  it("sorts matching language voices first", () => {
    const voices = toBrowserTtsVoiceOptions(
      [
        { voiceURI: "a", name: "Google EN", lang: "en-US", localService: false },
        { voiceURI: "b", name: "Tracy", lang: "zh-HK", localService: true },
      ] as SpeechSynthesisVoice[],
      "zh-HK",
    );
    expect(voices[0]?.voiceURI).toBe("b");
  });

  it("keeps every getVoices() entry (no locale filter or cap)", () => {
    const voices = toBrowserTtsVoiceOptions(
      [
        { voiceURI: "de", name: "Hedda", lang: "de-DE", localService: true },
        { voiceURI: "en", name: "Zira", lang: "en-US", localService: true },
        { voiceURI: "zh", name: "Tracy", lang: "zh-HK", localService: true },
        { voiceURI: "ja", name: "Haruka", lang: "ja-JP", localService: false },
      ] as SpeechSynthesisVoice[],
      "zh-HK",
    );
    expect(voices.map((v) => v.voiceURI)).toEqual(["zh", "de", "en", "ja"]);
  });

  it("truncates voice URI", () => {
    expect(normalizeTtsVoiceUri("  x  ")).toBe("x");
    expect(normalizeTtsVoiceUri("a".repeat(600)).length).toBe(512);
  });
});

describe("ttsSpeakOptionsFromVoiceSettings", () => {
  it("includes voiceUri when set", () => {
    expect(
      ttsSpeakOptionsFromVoiceSettings({
        speechLanguage: "zh-HK",
        ttsVoiceUri: "Microsoft Tracy",
      }),
    ).toEqual({ lang: "zh-HK", voiceUri: "Microsoft Tracy" });
  });

  it("omits voiceUri when empty", () => {
    expect(
      ttsSpeakOptionsFromVoiceSettings({
        speechLanguage: "zh-HK",
        ttsVoiceUri: "",
      }),
    ).toEqual({ lang: "zh-HK" });
  });
});
