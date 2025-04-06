import { createI18n } from 'vue-i18n';

import en from './en.json';
import zh from './zh-cn.json';
import zhTw from './zh-tw.json';
import ja from './ja.json';
import de from './de.json';
import ko from './ko.json';
import ru from './ru.json';
import fr from './fr.json';
import ar from './ar.json';

const i18n = createI18n({
    legacy: false,
    locale: 'zh',
    warnHtmlMessage: false,
    messages: { en, zh, zhTw, ja, de, ko, ru, fr, ar }
});

export default i18n;