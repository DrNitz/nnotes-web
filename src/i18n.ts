/** UI-localisation layer. Document content is never translated. */
import { useCallback } from 'react';
import { useEditor } from './store/editor';

export const LANGS = {
  en: 'English', hi: 'हिन्दी', es: 'Español', fr: 'Français', de: 'Deutsch',
  ja: '日本語', ru: 'Русский', ar: 'العربية', pt: 'Português', zh: '中文',
} as const;

export type Lang = keyof typeof LANGS;
export const isRtl = (lang: Lang) => lang === 'ar';

const en = {
  undo: 'Undo', redo: 'Redo', zoomOut: 'Zoom out', zoomIn: 'Zoom in',
  newNote: 'New note', openNote: 'Open .nnote', docSwitcher: 'Document switcher',
  importPdf: 'Import PDF', exportPdf: 'Export PDF', save: 'Save to browser',
  exportNnote: 'Export .nnote', studio: 'Studio · focus & streak', theme: 'Switch theme',
  bookmark: 'Bookmark this page', addPage: 'Add page', deletePage: 'Delete page',
  pages: 'PAGES', bookmarks: 'BOOKMARKS', minimap: 'MINIMAP', flowText: 'FLOW TEXT',
  recentNotes: 'RECENT NOTES', pdfReference: 'PDF REFERENCE', importPdfHint: 'Import a PDF to see its pages here.',
  tools: 'TOOLS', dock: 'DOCK', ink: 'INK', eraser: 'ERASER', shape: 'SHAPE',
  stickyStyle: 'STICKY STYLE', tableSize: 'TABLE SIZE', tapePattern: 'TAPE PATTERN',
  gestures: 'GESTURES', ruler: 'RULER', gesturesHint: 'Hold still before lifting the pen to snap your ink into a perfect shape.',
  scribbleToErase: 'Scribble to erase', showRuler: 'Show ruler', lockRuler: 'Lock ruler',
  width: 'Width', pressure: 'Pressure', neonGlow: 'Neon glow', constantSize: 'Constant screen size',
  opacity: 'Opacity', dash: 'Dash', gap: 'Gap', nib: 'Nib', speed: 'Speed', taper: 'Taper',
  rows: 'Rows', columns: 'Columns', radius: 'Radius', pressureNote: 'Hold still to snap ink into a shape.',
  duplicate: 'Duplicate', group: 'Group', front: 'Front', back: 'Back', rotate: 'Rotate',
  edit: 'Edit', delete: 'Delete', selected: 'selected', items: 'items', done: 'Done',
  page: 'Page', tool: 'Tool', localFirst: 'Local-first · saved in your browser',
  searchNotes: 'Search notes…', noNotes: 'No saved notes match', close: 'Close',
  focus: 'Focus', break: 'Break', streak: 'day streak', language: 'Language',
  present: 'Present / whiteboard', exitPresent: 'Exit presentation',
  beautify: 'Auto-beautify', record: 'Record voice note',
  stopRecording: 'Stop recording', recordHint: 'Click a voice clip on the canvas to play it back.',
  audioClip: 'VOICE NOTE', vectorPdf: 'Vector PDF export', export: 'EXPORT',
  untitled: 'Untitled', screenshotCopied: 'Screenshot copied to clipboard',
} as const;

export type Key = keyof typeof en;
type Dict = Record<Key, string>;

const hi: Partial<Dict> = {
  undo: 'पूर्ववत करें', redo: 'फिर करें', zoomOut: 'ज़ूम घटाएँ', zoomIn: 'ज़ूम बढ़ाएँ',
  newNote: 'नया नोट', openNote: 'खोलें .nnote', docSwitcher: 'दस्तावेज़ स्विचर',
  importPdf: 'PDF आयात करें', exportPdf: 'PDF निर्यात करें', save: 'ब्राउज़र में सहेजें',
  exportNnote: 'निर्यात .nnote', studio: 'स्टूडियो · फोकस और स्ट्रीक', theme: 'थीम बदलें',
  bookmark: 'इस पृष्ठ को बुकमार्क करें', addPage: 'पृष्ठ जोड़ें', deletePage: 'पृष्ठ हटाएँ',
  pages: 'पृष्ठ', bookmarks: 'बुकमार्क', minimap: 'लघु नक्शा', flowText: 'फ़्लो टेक्स्ट',
  recentNotes: 'हाल के नोट्स', pdfReference: 'PDF संदर्भ', tools: 'टूल्स', dock: 'डॉक',
  ink: 'स्याही', eraser: 'इरेज़र', shape: 'आकार', stickyStyle: 'स्टिकी शैली',
  tableSize: 'तालिका आकार', tapePattern: 'टेप पैटर्न', gestures: 'इशारे', ruler: 'रूलर',
  scribbleToErase: 'स्क्रिबल से मिटाएँ', showRuler: 'रूलर दिखाएँ', lockRuler: 'रूलर लॉक करें',
  width: 'चौड़ाई', pressure: 'दबाव', neonGlow: 'नियॉन चमक', constantSize: 'स्थिर स्क्रीन आकार',
  opacity: 'अस्पष्टता', dash: 'डैश', gap: 'अंतर', nib: 'निब', speed: 'गति', taper: 'टेपर',
  rows: 'पंक्तियाँ', columns: 'स्तंभ', radius: 'त्रिज्या', duplicate: 'डुप्लिकेट', group: 'समूह',
  front: 'सामने', back: 'पीछे', rotate: 'घुमाएँ', edit: 'संपादित करें', delete: 'हटाएँ',
  selected: 'चयनित', done: 'पूर्ण', page: 'पृष्ठ', tool: 'टूल',
  localFirst: 'स्थानीय-प्रथम · ब्राउज़र में सहेजा गया', searchNotes: 'नोट्स खोजें…',
  noNotes: 'कोई नोट नहीं मिला', close: 'बंद करें', focus: 'फोकस', break: 'ब्रेक',
  streak: 'दिन की स्ट्रीक', language: 'भाषा', untitled: 'बिना शीर्षक',
};

const es: Partial<Dict> = {
  undo: 'Deshacer', redo: 'Rehacer', zoomOut: 'Alejar', zoomIn: 'Acercar',
  newNote: 'Nueva nota', openNote: 'Abrir .nnote', docSwitcher: 'Cambiar documento',
  importPdf: 'Importar PDF', exportPdf: 'Exportar PDF', save: 'Guardar en navegador',
  exportNnote: 'Exportar .nnote', studio: 'Estudio · enfoque y racha', theme: 'Cambiar tema',
  bookmark: 'Marcar esta página', addPage: 'Añadir página', deletePage: 'Eliminar página',
  pages: 'PÁGINAS', bookmarks: 'MARCADORES', minimap: 'MAPA', flowText: 'TEXTO FLUIDO',
  recentNotes: 'NOTAS RECIENTES', pdfReference: 'REFERENCIA PDF', tools: 'HERRAMIENTAS',
  dock: 'UBICACIÓN', ink: 'TINTA', eraser: 'BORRADOR', shape: 'FORMA',
  stickyStyle: 'ESTILO DE NOTA', tableSize: 'TAMAÑO DE TABLA', tapePattern: 'PATRÓN DE CINTA',
  gestures: 'GESTOS', ruler: 'REGLA', scribbleToErase: 'Garabatear para borrar',
  showRuler: 'Mostrar regla', lockRuler: 'Bloquear regla', width: 'Ancho', pressure: 'Presión',
  neonGlow: 'Brillo neón', constantSize: 'Tamaño constante', opacity: 'Opacidad',
  dash: 'Guion', gap: 'Espacio', nib: 'Pluma', speed: 'Velocidad', taper: 'Cono',
  rows: 'Filas', columns: 'Columnas', radius: 'Radio', duplicate: 'Duplicar', group: 'Agrupar',
  front: 'Delante', back: 'Detrás', rotate: 'Rotar', edit: 'Editar', delete: 'Eliminar',
  selected: 'seleccionados', done: 'Listo', page: 'Página', tool: 'Herramienta',
  localFirst: 'Local primero · guardado en el navegador', searchNotes: 'Buscar notas…',
  noNotes: 'No hay notas que coincidan', close: 'Cerrar', focus: 'Enfoque', break: 'Descanso',
  streak: 'días de racha', language: 'Idioma', untitled: 'Sin título',
};

const fr: Partial<Dict> = {
  undo: 'Annuler', redo: 'Rétablir', zoomOut: 'Dézoomer', zoomIn: 'Zoomer',
  newNote: 'Nouvelle note', openNote: 'Ouvrir .nnote', docSwitcher: 'Changer de document',
  importPdf: 'Importer un PDF', exportPdf: 'Exporter en PDF', save: 'Enregistrer dans le navigateur',
  exportNnote: 'Exporter .nnote', studio: 'Studio · focus et série', theme: 'Changer de thème',
  bookmark: 'Marquer cette page', addPage: 'Ajouter une page', deletePage: 'Supprimer la page',
  pages: 'PAGES', bookmarks: 'SIGNETS', minimap: 'MINICARTE', flowText: 'TEXTE FLUIDE',
  recentNotes: 'NOTES RÉCENTES', pdfReference: 'RÉFÉRENCE PDF', tools: 'OUTILS', dock: 'DOCK',
  ink: 'ENCRE', eraser: 'GOMME', shape: 'FORME', stickyStyle: 'STYLE DE NOTE',
  tableSize: 'TAILLE DU TABLEAU', tapePattern: 'MOTIF DE RUBAN', gestures: 'GESTES', ruler: 'RÈGLE',
  scribbleToErase: 'Griffonner pour effacer', showRuler: 'Afficher la règle', lockRuler: 'Verrouiller la règle',
  width: 'Largeur', pressure: 'Pression', neonGlow: 'Halo néon', constantSize: 'Taille constante',
  opacity: 'Opacité', dash: 'Tiret', gap: 'Espacement', nib: 'Plume', speed: 'Vitesse', taper: 'Effilé',
  rows: 'Lignes', columns: 'Colonnes', radius: 'Rayon', duplicate: 'Dupliquer', group: 'Grouper',
  front: 'Devant', back: 'Derrière', rotate: 'Pivoter', edit: 'Modifier', delete: 'Supprimer',
  selected: 'sélectionnés', done: 'Terminé', page: 'Page', tool: 'Outil',
  localFirst: 'Local d’abord · enregistré dans le navigateur', searchNotes: 'Rechercher…',
  noNotes: 'Aucune note correspondante', close: 'Fermer', focus: 'Concentration', break: 'Pause',
  streak: 'jours de série', language: 'Langue', untitled: 'Sans titre',
};

const de: Partial<Dict> = {
  undo: 'Rückgängig', redo: 'Wiederholen', zoomOut: 'Verkleinern', zoomIn: 'Vergrößern',
  newNote: 'Neue Notiz', openNote: 'Öffnen .nnote', docSwitcher: 'Dokumentwechsler',
  importPdf: 'PDF importieren', exportPdf: 'PDF exportieren', save: 'Im Browser speichern',
  exportNnote: 'Exportieren .nnote', studio: 'Studio · Fokus & Serie', theme: 'Design wechseln',
  bookmark: 'Seite markieren', addPage: 'Seite hinzufügen', deletePage: 'Seite löschen',
  pages: 'SEITEN', bookmarks: 'LESZEICHEN', minimap: 'MINIKARTE', flowText: 'FLIESSTEXT',
  recentNotes: 'LETZTE NOTIZEN', pdfReference: 'PDF-REFERENZ', tools: 'WERKZEUGE', dock: 'DOCK',
  ink: 'TINTE', eraser: 'RADIERER', shape: 'FORM', stickyStyle: 'NOTIZSTIL',
  tableSize: 'TABELLENGRÖSSE', tapePattern: 'KLEBEBANDMUSTER', gestures: 'GESTEN', ruler: 'LINEAL',
  scribbleToErase: 'Kritzeln zum Radieren', showRuler: 'Lineal anzeigen', lockRuler: 'Lineal sperren',
  width: 'Breite', pressure: 'Druck', neonGlow: 'Neon-Glanz', constantSize: 'Konstante Größe',
  opacity: 'Deckkraft', dash: 'Strich', gap: 'Lücke', nib: 'Feder', speed: 'Geschwindigkeit', taper: 'Spitze',
  rows: 'Zeilen', columns: 'Spalten', radius: 'Radius', duplicate: 'Duplizieren', group: 'Gruppieren',
  front: 'Nach vorn', back: 'Nach hinten', rotate: 'Drehen', edit: 'Bearbeiten', delete: 'Löschen',
  selected: 'ausgewählt', done: 'Fertig', page: 'Seite', tool: 'Werkzeug',
  localFirst: 'Lokal zuerst · im Browser gespeichert', searchNotes: 'Notizen suchen…',
  noNotes: 'Keine passenden Notizen', close: 'Schließen', focus: 'Fokus', break: 'Pause',
  streak: 'Tage Serie', language: 'Sprache', untitled: 'Unbenannt',
};

const ja: Partial<Dict> = {
  undo: '元に戻す', redo: 'やり直す', zoomOut: '縮小', zoomIn: '拡大',
  newNote: '新しいノート', openNote: '.nnote を開く', docSwitcher: 'ドキュメント切替',
  importPdf: 'PDF を読み込む', exportPdf: 'PDF を書き出す', save: 'ブラウザに保存',
  exportNnote: '.nnote を書き出す', studio: 'スタジオ · 集中と記録', theme: 'テーマ切替',
  bookmark: 'このページをブックマーク', addPage: 'ページを追加', deletePage: 'ページを削除',
  pages: 'ページ', bookmarks: 'ブックマーク', minimap: 'ミニマップ', flowText: 'フローテキスト',
  recentNotes: '最近のノート', pdfReference: 'PDF 参照', tools: 'ツール', dock: 'ドック',
  ink: 'インク', eraser: '消しゴム', shape: '図形', stickyStyle: '付箋スタイル',
  tableSize: 'テーブルサイズ', tapePattern: 'テープ模様', gestures: 'ジェスチャー', ruler: '定規',
  scribbleToErase: 'なぐり書きで消去', showRuler: '定規を表示', lockRuler: '定規を固定',
  width: '幅', pressure: '筆圧', neonGlow: 'ネオン', constantSize: '一定サイズ',
  opacity: '不透明度', dash: '破線', gap: '間隔', nib: 'ペン先', speed: '速度', taper: 'テーパー',
  rows: '行', columns: '列', radius: '半径', duplicate: '複製', group: 'グループ化',
  front: '前面へ', back: '背面へ', rotate: '回転', edit: '編集', delete: '削除',
  selected: '選択中', done: '完了', page: 'ページ', tool: 'ツール',
  localFirst: 'ローカル優先 · ブラウザに保存', searchNotes: 'ノートを検索…',
  noNotes: '一致するノートはありません', close: '閉じる', focus: '集中', break: '休憩',
  streak: '日連続', language: '言語', untitled: '無題',
};

const ru: Partial<Dict> = {
  undo: 'Отменить', redo: 'Повторить', zoomOut: 'Уменьшить', zoomIn: 'Увеличить',
  newNote: 'Новая заметка', openNote: 'Открыть .nnote', docSwitcher: 'Смена документа',
  importPdf: 'Импорт PDF', exportPdf: 'Экспорт PDF', save: 'Сохранить в браузере',
  exportNnote: 'Экспорт .nnote', studio: 'Студия · фокус и серия', theme: 'Сменить тему',
  bookmark: 'Закладка на страницу', addPage: 'Добавить страницу', deletePage: 'Удалить страницу',
  pages: 'СТРАНИЦЫ', bookmarks: 'ЗАКЛАДКИ', minimap: 'МИНИКАРТА', flowText: 'ПОТОКОВЫЙ ТЕКСТ',
  recentNotes: 'НЕДАВНИЕ', pdfReference: 'PDF-ИСТОЧНИК', tools: 'ИНСТРУМЕНТЫ', dock: 'ПАНЕЛЬ',
  ink: 'ЧЕРНИЛА', eraser: 'ЛАСТИК', shape: 'ФИГУРА', stickyStyle: 'СТИЛЬ ЗАМЕТКИ',
  tableSize: 'РАЗМЕР ТАБЛИЦЫ', tapePattern: 'УЗОР ЛЕНТЫ', gestures: 'ЖЕСТЫ', ruler: 'ЛИНЕЙКА',
  scribbleToErase: 'Стирать каракулями', showRuler: 'Показать линейку', lockRuler: 'Закрепить линейку',
  width: 'Ширина', pressure: 'Нажим', neonGlow: 'Неоновое свечение', constantSize: 'Постоянный размер',
  opacity: 'Прозрачность', dash: 'Штрих', gap: 'Пробел', nib: 'Перо', speed: 'Скорость', taper: 'Суженный кончик',
  rows: 'Строки', columns: 'Столбцы', radius: 'Радиус', duplicate: 'Дублировать', group: 'Группировать',
  front: 'На передний план', back: 'На задний план', rotate: 'Повернуть', edit: 'Изменить', delete: 'Удалить',
  selected: 'выбрано', done: 'Готово', page: 'Страница', tool: 'Инструмент',
  localFirst: 'Сначала локально · сохранено в браузере', searchNotes: 'Поиск заметок…',
  noNotes: 'Заметки не найдены', close: 'Закрыть', focus: 'Фокус', break: 'Перерыв',
  streak: 'дней подряд', language: 'Язык', untitled: 'Без названия',
};

const ar: Partial<Dict> = {
  undo: 'تراجع', redo: 'إعادة', zoomOut: 'تصغير', zoomIn: 'تكبير',
  newNote: 'ملاحظة جديدة', openNote: 'فتح .nnote', docSwitcher: 'تبديل المستندات',
  importPdf: 'استيراد PDF', exportPdf: 'تصدير PDF', save: 'حفظ في المتصفح',
  exportNnote: 'تصدير .nnote', studio: 'الاستوديو · التركيز والسلسلة', theme: 'تغيير المظهر',
  bookmark: 'إضافة إشارة مرجعية', addPage: 'إضافة صفحة', deletePage: 'حذف الصفحة',
  pages: 'الصفحات', bookmarks: 'المراجع', minimap: 'الخريطة المصغرة', flowText: 'النص المتدفق',
  recentNotes: 'الملاحظات الأخيرة', pdfReference: 'مرجع PDF', tools: 'الأدوات', dock: 'الشريط',
  ink: 'الحبر', eraser: 'الممحاة', shape: 'الشكل', stickyStyle: 'نمط الملاحظة',
  tableSize: 'حجم الجدول', tapePattern: 'نمط الشريط', gestures: 'الإيماءات', ruler: 'المسطرة',
  scribbleToErase: 'الخربشة للمسح', showRuler: 'إظهار المسطرة', lockRuler: 'تثبيت المسطرة',
  width: 'العرض', pressure: 'الضغط', neonGlow: 'توهج نيون', constantSize: 'حمل ثابت',
  opacity: 'الشفافية', dash: 'شرطة', gap: 'فجوة', nib: 'السن', speed: 'السرعة', taper: 'المدبب',
  rows: 'الصفوف', columns: 'الأعمدة', radius: 'نصف القطر', duplicate: 'نسخ', group: 'تجميع',
  front: 'إلى الأمام', back: 'إلى الخلف', rotate: 'تدوير', edit: 'تحرير', delete: 'حذف',
  selected: 'محدد', done: 'تم', page: 'صفحة', tool: 'أداة',
  localFirst: 'محلي أولاً · محفوظ في المتصفح', searchNotes: 'ابحث في الملاحظات…',
  noNotes: 'لا توجد ملاحظات مطابقة', close: 'إغلاق', focus: 'تركيز', break: 'استراحة',
  streak: 'يوم متتالي', language: 'اللغة', untitled: 'بدون عنوان',
};

const pt: Partial<Dict> = {
  undo: 'Desfazer', redo: 'Refazer', zoomOut: 'Reduzir', zoomIn: 'Ampliar',
  newNote: 'Nova nota', openNote: 'Abrir .nnote', docSwitcher: 'Alternar documento',
  importPdf: 'Importar PDF', exportPdf: 'Exportar PDF', save: 'Guardar no navegador',
  exportNnote: 'Exportar .nnote', studio: 'Estúdio · foco e sequência', theme: 'Alternar tema',
  bookmark: 'Marcar esta página', addPage: 'Adicionar página', deletePage: 'Eliminar página',
  pages: 'PÁGINAS', bookmarks: 'MARCADORES', minimap: 'MINIMAPA', flowText: 'TEXTO FLUIDO',
  recentNotes: 'NOTAS RECENTES', pdfReference: 'REFERÊNCIA PDF', tools: 'FERRAMENTAS', dock: 'DOCK',
  ink: 'TINTA', eraser: 'BORRACHA', shape: 'FORMA', stickyStyle: 'ESTILO DE NOTA',
  tableSize: 'TAMANHO DA TABELA', tapePattern: 'PADRÃO DA FITA', gestures: 'GESTOS', ruler: 'RÉGUA',
  scribbleToErase: 'Rabiscar para apagar', showRuler: 'Mostrar régua', lockRuler: 'Bloquear régua',
  width: 'Largura', pressure: 'Pressão', neonGlow: 'Brilho néon', constantSize: 'Tamanho constante',
  opacity: 'Opacidade', dash: 'Traço', gap: 'Espaço', nib: 'Pena', speed: 'Velocidade', taper: 'Afiado',
  rows: 'Linhas', columns: 'Colunas', radius: 'Raio', duplicate: 'Duplicar', group: 'Agrupar',
  front: 'Frente', back: 'Atrás', rotate: 'Rodar', edit: 'Editar', delete: 'Eliminar',
  selected: 'selecionados', done: 'Concluído', page: 'Página', tool: 'Ferramenta',
  localFirst: 'Local primeiro · guardado no navegador', searchNotes: 'Pesquisar notas…',
  noNotes: 'Nenhuma nota encontrada', close: 'Fechar', focus: 'Foco', break: 'Pausa',
  streak: 'dias seguidos', language: 'Idioma', untitled: 'Sem título',
};

const zh: Partial<Dict> = {
  undo: '撤销', redo: '重做', zoomOut: '缩小', zoomIn: '放大',
  newNote: '新建笔记', openNote: '打开 .nnote', docSwitcher: '切换文档',
  importPdf: '导入 PDF', exportPdf: '导出 PDF', save: '保存到浏览器',
  exportNnote: '导出 .nnote', studio: '工作室 · 专注与连续天数', theme: '切换主题',
  bookmark: '收藏此页', addPage: '添加页面', deletePage: '删除页面',
  pages: '页面', bookmarks: '书签', minimap: '缩略图', flowText: '流式文本',
  recentNotes: '最近笔记', pdfReference: 'PDF 参考', tools: '工具', dock: '停靠',
  ink: '墨水', eraser: '橡皮', shape: '形状', stickyStyle: '便签样式',
  tableSize: '表格大小', tapePattern: '胶带图案', gestures: '手势', ruler: '标尺',
  scribbleToErase: '涂鸦擦除', showRuler: '显示标尺', lockRuler: '锁定标尺',
  width: '宽度', pressure: '压感', neonGlow: '霓虹光晕', constantSize: '恒定尺寸',
  opacity: '不透明度', dash: '虚线', gap: '间隔', nib: '笔尖', speed: '速度', taper: '渐细',
  rows: '行', columns: '列', radius: '半径', duplicate: '复制', group: '分组',
  front: '置于顶层', back: '置于底层', rotate: '旋转', edit: '编辑', delete: '删除',
  selected: '已选择', done: '完成', page: '页', tool: '工具',
  localFirst: '本地优先 · 保存在浏览器中', searchNotes: '搜索笔记…',
  noNotes: '没有匹配的笔记', close: '关闭', focus: '专注', break: '休息',
  streak: '天连续', language: '语言', untitled: '无标题',
};

const dictionaries: Record<Lang, Partial<Dict>> = { en, hi, es, fr, de, ja, ru, ar, pt, zh };

const TOOL_LABELS: Record<string, string> = {
  pen: 'Ballpoint pen', pencil: 'Graphite pencil', dashed: 'Dashed pen',
  calligraphy: 'Calligraphy brush', speed: 'Speed pen', taper: 'Taper pen',
  highlighter: 'Highlighter', eraser: 'Eraser', pan: 'Pan', select: 'Select',
  lasso: 'Lasso', shape: 'Shapes', text: 'Text', sticky_note: 'Sticky note',
  table: 'Table', mind_map: 'Mind map', audio_clip: 'Voice note', image: 'Image',
  tape: 'Study tape', screenshot: 'Screenshot area', magic: 'Disappearing ink',
};

const TOOL_TRANSLATIONS: Partial<Record<Lang, Record<string, string>>> = {
  hi: { pen: 'बॉलपॉइंट पेन', pencil: 'ग्रेफाइट पेंसिल', dashed: 'डैश्ड पेन', calligraphy: 'कैलिग्राफी ब्रश', speed: 'स्पीड पेन', taper: 'टेपर पेन', highlighter: 'हाइलाइटर', eraser: 'इरेज़र', pan: 'पैन', select: 'चयन', lasso: 'लैसो', shape: 'आकार', text: 'टेक्स्ट', sticky_note: 'स्टिकी नोट', table: 'तालिका', mind_map: 'माइंड मैप', audio_clip: 'वॉइस नोट', image: 'छवि', tape: 'स्टडी टेप' },
  es: { pen: 'Pluma', pencil: 'Lápiz', dashed: 'Pluma discontinua', calligraphy: 'Caligrafía', speed: 'Pluma rápida', taper: 'Pluma afinada', highlighter: 'Resaltador', eraser: 'Borrador', pan: 'Mover', select: 'Seleccionar', lasso: 'Lazo', shape: 'Formas', text: 'Texto', sticky_note: 'Nota adhesiva', table: 'Tabla', mind_map: 'Mapa mental', audio_clip: 'Nota de voz', image: 'Imagen', tape: 'Cinta de estudio' },
  fr: { pen: 'Stylo bille', pencil: 'Crayon', dashed: 'Stylo tireté', calligraphy: 'Calligraphie', speed: 'Stylo rapide', taper: 'Stylo effilé', highlighter: 'Surligneur', eraser: 'Gomme', pan: 'Déplacer', select: 'Sélection', lasso: 'Lasso', shape: 'Formes', text: 'Texte', sticky_note: 'Note collante', table: 'Tableau', mind_map: 'Carte mentale', audio_clip: 'Note vocale', image: 'Image', tape: 'Ruban' },
  de: { pen: 'Kugelschreiber', pencil: 'Bleistift', dashed: 'Gestrichelt', calligraphy: 'Kalligrafie', speed: 'Schnellstift', taper: 'Spitzstift', highlighter: 'Marker', eraser: 'Radierer', pan: 'Verschieben', select: 'Auswahl', lasso: 'Lasso', shape: 'Formen', text: 'Text', sticky_note: 'Haftnotiz', table: 'Tabelle', mind_map: 'Mindmap', audio_clip: 'Sprachnotiz', image: 'Bild', tape: 'Klebeband' },
  ja: { pen: 'ボールペン', pencil: '鉛筆', dashed: '破線ペン', calligraphy: '筆', speed: 'スピードペン', taper: 'テーパーペン', highlighter: '蛍光ペン', eraser: '消しゴム', pan: '移動', select: '選択', lasso: '投げ縄', shape: '図形', text: 'テキスト', sticky_note: '付箋', table: 'テーブル', mind_map: 'マインドマップ', audio_clip: '音声メモ', image: '画像', tape: 'テープ' },
  ru: { pen: 'Шариковая ручка', pencil: 'Карандаш', dashed: 'Пунктир', calligraphy: 'Каллиграфия', speed: 'Скоростное перо', taper: 'Заострённое перо', highlighter: 'Маркер', eraser: 'Ластик', pan: 'Перемещение', select: 'Выделение', lasso: 'Лассо', shape: 'Фигуры', text: 'Текст', sticky_note: 'Заметка', table: 'Таблица', mind_map: 'Карта знаний', audio_clip: 'Голосовая заметка', image: 'Изображение', tape: 'Лента' },
  ar: { pen: 'قلم حبر', pencil: 'قلم رصاص', dashed: 'قلم متقطع', calligraphy: 'خط عربي', speed: 'قلم سريع', taper: 'قلم مدبب', highlighter: 'تحديد', eraser: 'ممحاة', pan: 'تحريك', select: 'تحديد', lasso: 'لاسو', shape: 'أشكال', text: 'نص', sticky_note: 'ملاحظة لاصقة', table: 'جدول', mind_map: 'خريطة ذهنية', audio_clip: 'ملاحظة صوتية', image: 'صورة', tape: 'شريط' },
  pt: { pen: 'Caneta', pencil: 'Lápis', dashed: 'Caneta tracejada', calligraphy: 'Caligrafia', speed: 'Caneta rápida', taper: 'Caneta afinada', highlighter: 'Marca-texto', eraser: 'Borracha', pan: 'Mover', select: 'Selecionar', lasso: 'Laço', shape: 'Formas', text: 'Texto', sticky_note: 'Nota adesiva', table: 'Tabela', mind_map: 'Mapa mental', audio_clip: 'Nota de voz', image: 'Imagem', tape: 'Fita' },
  zh: { pen: '圆珠笔', pencil: '铅笔', dashed: '虚线笔', calligraphy: '书法笔', speed: '速写笔', taper: '尖细笔', highlighter: '荧光笔', eraser: '橡皮', pan: '平移', select: '选择', lasso: '套索', shape: '形状', text: '文本', sticky_note: '便签', table: '表格', mind_map: '思维导图', audio_clip: '语音笔记', image: '图片', tape: '胶带' },
};

export function toolName(lang: Lang, id: string): string {
  return TOOL_TRANSLATIONS[lang]?.[id] ?? TOOL_LABELS[id] ?? id;
}

export function translate(lang: Lang, key: Key): string {
  return dictionaries[lang]?.[key] ?? en[key];
}

export function useT() {
  const lang = useEditor((s) => s.lang) as Lang;
  return useCallback((key: Key) => translate(lang, key), [lang]);
}
