import { Setting, TAbstractFile, TFolder, TextComponent } from 'obsidian';

import MathBooster from '../main';
import { ENV_IDs, ENVs, TheoremLikeEnv, getTheoremLikeEnv } from '../env';
import { DEFAULT_SETTINGS, MATH_CALLOUT_REF_FORMATS, MATH_CALLOUT_STYLES, MathCalloutSettings, MathContextSettings, MathSettings, NumberStyle, RenameEnv } from './settings';
import LanguageManager from '../language';


export class MathCalloutSettingsHelper {
    env: TheoremLikeEnv;
    constructor(
        public contentEl: HTMLElement,
        public settings: MathCalloutSettings,
        public defaultSettings: Required<MathContextSettings> & Partial<MathCalloutSettings>,
    ) { }

    makeSettingPane() {
        const { contentEl } = this;
        new Setting(contentEl)
            .setName("Type")
            .addDropdown((dropdown) => {
                for (const env of ENVs) {
                    dropdown.addOption(env.id, env.id);
                    if (this.defaultSettings.type) {
                        dropdown.setValue(String(this.defaultSettings.type));
                    }
                }

                const initType = dropdown.getValue();
                this.settings.type = initType;
                this.env = getTheoremLikeEnv(initType);

                const numberSetting = new Setting(contentEl)
                    .setName("Number")
                    .setDesc("Allowed values:");
                const numberSettingDescList = numberSetting.descEl.createEl("ul");
                numberSettingDescList.createEl(
                    "li",
                    { text: '"auto" - automatically numbered' }
                );
                numberSettingDescList.createEl(
                    "li",
                    { text: "blank - unnumbered" }
                );
                numberSettingDescList.createEl(
                    "li",
                    { text: "otherwise - used as is" }
                );

                numberSetting.addText((text) => {
                    text.setValue(
                        this.defaultSettings.number ?? this.defaultSettings.numberDefault
                    );
                    this.settings.number = text.getValue();
                    text.onChange((value) => {
                        this.settings.number = value;
                    });
                })

                const titlePane = new Setting(contentEl)
                    .setName("Title")
                    .setDesc("You may use inline math");


                const labelPane = new Setting(contentEl).setName("LaTeX Label");
                const labelPrefixEl = labelPane.controlEl.createDiv({
                    text: this.env.prefix + ":" + (this.defaultSettings.labelPrefix ?? "")
                });

                titlePane.addText((text) => {
                    text.inputEl.setAttribute('style', 'width: 300px;')
                    if (this.defaultSettings.title) {
                        text.setValue(this.defaultSettings.title);
                    }

                    let labelTextComp: TextComponent;
                    labelPane.addText((text) => {
                        labelTextComp = text;
                        text.inputEl.setAttribute('style', 'width: 300px;')
                        if (this.defaultSettings.label) {
                            text.setValue(this.defaultSettings.label);
                        }
                        text.onChange((value) => {
                            this.settings.label = value;
                        });
                    });

                    text
                        .setPlaceholder("ex) $\\sigma$-algebra")
                        .onChange((value) => {
                            this.settings.title = value;
                            let labelInit = this.settings.title.replaceAll(' ', '-').replaceAll("'s", '').toLowerCase();
                            labelInit = labelInit.replaceAll(/[^a-z0-1\-]/g, '');
                            labelTextComp.setValue(labelInit);
                            this.settings.label = labelInit;
                        })
                });

                dropdown.onChange((value) => {
                    this.settings.type = value;
                    this.env = getTheoremLikeEnv(value);
                    labelPrefixEl.textContent = this.env.prefix + ":";
                    if (this.defaultSettings.labelPrefix) {
                        labelPrefixEl.textContent += this.defaultSettings.labelPrefix;
                    }
                });
            });
    }
}


export class MathContextSettingsHelper {
    allowUnset: boolean;

    constructor(
        public contentEl: HTMLElement,
        public settings: Partial<MathContextSettings>,
        public defaultSettings: MathContextSettings,
        public plugin: MathBooster,
        public file: TAbstractFile,
    ) {
        this.allowUnset = !(this.file instanceof TFolder && this.file.isRoot());
    }

    getCallback<Type>(name: keyof MathSettings): (value: Type) => Promise<void> {
        return async (value: Type): Promise<void> => {
            Object.assign(this.settings, { [name]: value });
            this.plugin.app.metadataCache.trigger("math-booster:local-settings-updated", this.file);
            await this.plugin?.saveSettings();
        }
    }

    makeSettingPane() {
        const { contentEl } = this;

        contentEl.createEl("h3", { text: "Math callouts" });
        this.addDropdownSetting("lang", LanguageManager.supported, this.allowUnset, "Language");
        const styleSetting = this.addDropdownSetting("mathCalloutStyle", MATH_CALLOUT_STYLES, this.allowUnset, "Style");
        styleSetting.descEl.replaceChildren(
            "Choose between your custom style and pre-defined sample styles. You will need to reload the note to see the changes. See the ",
            createEl("a", {text: "documentation", attr: {href: "https://ryotaushio.github.io/obsidian-math-booster/style-your-theorems.html"}}), 
            " for how to customize the appearance of math callouts.",
        );
        this.addToggleSetting("mathCalloutFontInherit", "Don't override the app's font setting when using sample styles", "You will need to reload the note to see the changes.");
        this.addTextSetting("titleSuffix", "Title suffix", "ex) \"\" > Definition 2 (Group) / \".\" > Definition 2 (Group).");
        this.addTextSetting("labelPrefix", "LaTeX label prefix", 'ex) "geometry:" > a theorem with label="pythhagorean-theorem" will be given a LaTeX label "thm:geometry:pythhagorean-theorem"');
        this.addRenameSetting();
        contentEl.createEl("h6", { text: "Numbering" });
        this.addTextSetting("numberPrefix", "Prefix");
        this.addTextSetting("numberSuffix", "Suffix");
        this.addTextSetting("numberInit", "Initial count");
        this.addNumberStyleSetting("numberStyle", "Numbering style");
        this.addTextSetting("numberDefault", "Default value for the \"Number\" field");
        contentEl.createEl("h6", { text: "Referencing" });
        this.addDropdownSetting("refFormat", MATH_CALLOUT_REF_FORMATS, this.allowUnset, "Format");

        contentEl.createEl("h3", { text: "Equations" });
        contentEl.createEl("h6", { text: "Numbering" });
        this.addTextSetting("eqNumberPrefix", "Prefix");
        this.addTextSetting("eqNumberSuffix", "Suffix");
        this.addTextSetting("eqNumberInit", "Initial count");
        this.addNumberStyleSetting("eqNumberStyle", "Equation numbering style");
        this.addToggleSetting("lineByLine", "Number line by line in align");
        contentEl.createEl("h6", { text: "Referencing" });
        this.addTextSetting("eqRefPrefix", "Prefix");
        this.addTextSetting("eqRefSuffix", "Suffix");
    }

    addDropdownSetting(name: keyof MathContextSettings, options: readonly string[], allowUnset: boolean, prettyName: string, description?: string) {
        const callback = this.getCallback<string>(name);
        const setting = new Setting(this.contentEl).setName(prettyName);
        if (description) {
            setting.setDesc(description);
        }
        setting.addDropdown((dropdown) => {
            if (allowUnset) {
                dropdown.addOption("", "");
            }
            for (const option of options) {
                dropdown.addOption(option, option);
            }
            dropdown.setValue(
                allowUnset
                ? (this.settings[name] ? this.defaultSettings[name] as string : "")
                : this.defaultSettings[name] as string
            ).onChange(callback);
        });
        return setting;
    }

    addTextSetting(name: keyof MathContextSettings, prettyName: string, description?: string): Setting {
        const callback = this.getCallback<string>(name);
        const setting = new Setting(this.contentEl).setName(prettyName);
        if (description) {
            setting.setDesc(description);
        }
        setting.addText((text) => {
            text
                .setPlaceholder(String(this.defaultSettings[name] ?? ""))
                .setValue(String(this.settings[name] ?? ""))
                .onChange(callback)
        });
        return setting;
    }

    addRenameSetting() {
        const { contentEl } = this;
        const setting = new Setting(contentEl)
            .setName("Rename environments")
            .setDesc("ex) print \"exercise\" as \"Problem,\" not \"Exercise\"");

        setting.addDropdown((dropdown) => {
            for (let envId of ENV_IDs) {
                dropdown.addOption(envId, envId);
            }
            dropdown.onChange((selectedEnvId) => {
                let renamePaneTextBox = new Setting(setting.controlEl).addText((text) => {
                    text.onChange(async (newName) => {
                        if (this.settings.rename === undefined) {
                            this.settings.rename = {} as RenameEnv;
                        }
                        Object.assign(this.settings.rename, { [selectedEnvId]: newName });
                        this.plugin.app.metadataCache.trigger("math-booster:local-settings-updated", this.file);            
                        await this.plugin?.saveSettings();
                    })
                });
                const inputEl = renamePaneTextBox.settingEl.querySelector<HTMLElement>("input");
                if (inputEl) {
                    renamePaneTextBox.settingEl.replaceWith(inputEl);
                }
            });
        });
        return setting;
    }

    addToggleSetting(name: "lineByLine" | "mathCalloutFontInherit", prettyName: string, descriptin?: string) {
        const setting = new Setting(this.contentEl).setName(prettyName);
        if (descriptin) {
            setting.setDesc(descriptin);
        }
        const callback = this.getCallback<boolean>(name);
        setting.addToggle((toggle) => {
            toggle.setValue(this.defaultSettings[name])
                  .onChange(callback);
        });
        return setting;
    }

    addNumberStyleSetting(name: "numberStyle" | "eqNumberStyle", prettyName?: string, description?: string) {
        const setting = new Setting(this.contentEl);
        if (prettyName) {
            setting.setName(prettyName);
        }
        if (description) {
            setting.setDesc(description);
        }
        const callback = this.getCallback<NumberStyle>(name);
        setting.addDropdown((dropdown) => {
            for (let style of ["arabic", "alph", "Alph", "roman", "Roman"]) {
                dropdown.addOption(style, style);
            }
            dropdown
                .setValue(this.defaultSettings[name] ?? DEFAULT_SETTINGS[name])
                .onChange(callback)
        });
        return setting;
    }
}
