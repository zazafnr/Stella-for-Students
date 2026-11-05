// Brücke zum Kern: das Plugin importiert vom Kern nur Typen. Alles, was zur Laufzeit gebraucht wird, reicht der Server beim Laden
// als `PluginApi` herein (siehe index.ts → bind). Die Weiterleitungen hier erlauben es, im Plugin-Code ganz normal
// `import { db, addItem } from './runtime.ts'` zu schreiben.

import type { PluginApi } from '../../core/server/src/plugin-api.ts';

export type {
  User, UserSettings, BookProvider, BookConfig, NewItem, ContentPart, Lesson, Lagebild, Busy, ActionType, ActionParams, Performed, EditionPlugin, PluginTool,
} from '../../core/server/src/plugin-api.ts';

let api: PluginApi | null = null;

/** Wird einmal beim Laden aufgerufen. */
export function bind(a: PluginApi): void { api = a; }

const live = (): PluginApi => {
  if (!api) throw new Error('Das Plugin wurde noch nicht mit der Plugin-API verbunden (bind).');
  return api;
};

/** Objekte (db, config): Zugriffe gehen an das Objekt des Servers */
const forward = <T extends object>(pick: (a: PluginApi) => T): T => new Proxy({} as T, {
  get: (_t, prop) => { const target = pick(live()) as Record<string | symbol, unknown>; const v = target[prop]; return typeof v === 'function' ? v.bind(target) : v; },
  set: (_t, prop, value) => { (pick(live()) as Record<string | symbol, unknown>)[prop] = value; return true; },
});

export const db = forward((a) => a.db);
export const config = forward((a) => a.config);

/** Die Fehlerklasse des Servers – nur sie wird dort in HTTP-Antworten übersetzt */
export const HttpError = new Proxy(class {} as unknown as PluginApi['HttpError'], {
  construct: (_t, args) => new (live().HttpError as new (...a: unknown[]) => object)(...args),
  get: (_t, prop) => (live().HttpError as unknown as Record<string | symbol, unknown>)[prop],
  has: (_t, prop) => prop in (live().HttpError as object),
  getPrototypeOf: () => Object.getPrototypeOf(live().HttpError),
}) as PluginApi['HttpError'];

export const addAttachment: PluginApi['addAttachment'] = ((...a: unknown[]) => (live().addAttachment as (...x: unknown[]) => unknown)(...a)) as PluginApi['addAttachment'];
export const addMessage: PluginApi['addMessage'] = ((...a: unknown[]) => (live().addMessage as (...x: unknown[]) => unknown)(...a)) as PluginApi['addMessage'];
export const addReminder: PluginApi['addReminder'] = ((...a: unknown[]) => (live().addReminder as (...x: unknown[]) => unknown)(...a)) as PluginApi['addReminder'];
export const enqueueJob: PluginApi['enqueueJob'] = ((...a: unknown[]) => (live().enqueueJob as (...x: unknown[]) => unknown)(...a)) as PluginApi['enqueueJob'];
export const getItem: PluginApi['getItem'] = ((...a: unknown[]) => (live().getItem as (...x: unknown[]) => unknown)(...a)) as PluginApi['getItem'];
export const getItemByExternalId: PluginApi['getItemByExternalId'] = ((...a: unknown[]) => (live().getItemByExternalId as (...x: unknown[]) => unknown)(...a)) as PluginApi['getItemByExternalId'];
export const getUser: PluginApi['getUser'] = ((...a: unknown[]) => (live().getUser as (...x: unknown[]) => unknown)(...a)) as PluginApi['getUser'];
export const notifyOnce: PluginApi['notifyOnce'] = ((...a: unknown[]) => (live().notifyOnce as (...x: unknown[]) => unknown)(...a)) as PluginApi['notifyOnce'];
export const now: PluginApi['now'] = ((...a: unknown[]) => (live().now as (...x: unknown[]) => unknown)(...a)) as PluginApi['now'];
export const newId: PluginApi['newId'] = ((...a: unknown[]) => (live().newId as (...x: unknown[]) => unknown)(...a)) as PluginApi['newId'];
export const createItem: PluginApi['createItem'] = ((...a: unknown[]) => (live().createItem as (...x: unknown[]) => unknown)(...a)) as PluginApi['createItem'];
export const updateItem: PluginApi['updateItem'] = ((...a: unknown[]) => (live().updateItem as (...x: unknown[]) => unknown)(...a)) as PluginApi['updateItem'];
export const listItems: PluginApi['listItems'] = ((...a: unknown[]) => (live().listItems as (...x: unknown[]) => unknown)(...a)) as PluginApi['listItems'];
export const updateUserSettings: PluginApi['updateUserSettings'] = ((...a: unknown[]) => (live().updateUserSettings as (...x: unknown[]) => unknown)(...a)) as PluginApi['updateUserSettings'];
export const getSecret: PluginApi['getSecret'] = ((...a: unknown[]) => (live().getSecret as (...x: unknown[]) => unknown)(...a)) as PluginApi['getSecret'];
export const setSecret: PluginApi['setSecret'] = ((...a: unknown[]) => (live().setSecret as (...x: unknown[]) => unknown)(...a)) as PluginApi['setSecret'];
export const hasSecret: PluginApi['hasSecret'] = ((...a: unknown[]) => (live().hasSecret as (...x: unknown[]) => unknown)(...a)) as PluginApi['hasSecret'];
export const deleteSecret: PluginApi['deleteSecret'] = ((...a: unknown[]) => (live().deleteSecret as (...x: unknown[]) => unknown)(...a)) as PluginApi['deleteSecret'];
export const requireOwner: PluginApi['requireOwner'] = ((...a: unknown[]) => (live().requireOwner as (...x: unknown[]) => unknown)(...a)) as PluginApi['requireOwner'];
export const addItem: PluginApi['addItem'] = ((...a: unknown[]) => (live().addItem as (...x: unknown[]) => unknown)(...a)) as PluginApi['addItem'];
export const changeItem: PluginApi['changeItem'] = ((...a: unknown[]) => (live().changeItem as (...x: unknown[]) => unknown)(...a)) as PluginApi['changeItem'];
export const bookFor: PluginApi['bookFor'] = ((...a: unknown[]) => (live().bookFor as (...x: unknown[]) => unknown)(...a)) as PluginApi['bookFor'];
export const bookForItem: PluginApi['bookForItem'] = ((...a: unknown[]) => (live().bookForItem as (...x: unknown[]) => unknown)(...a)) as PluginApi['bookForItem'];
export const notify: PluginApi['notify'] = ((...a: unknown[]) => (live().notify as (...x: unknown[]) => unknown)(...a)) as PluginApi['notify'];
export const voiceOf: PluginApi['voiceOf'] = ((...a: unknown[]) => (live().voiceOf as (...x: unknown[]) => unknown)(...a)) as PluginApi['voiceOf'];
export const userLocale: PluginApi['userLocale'] = ((...a: unknown[]) => (live().userLocale as (...x: unknown[]) => unknown)(...a)) as PluginApi['userLocale'];
export const userTerms: PluginApi['userTerms'] = ((...a: unknown[]) => (live().userTerms as (...x: unknown[]) => unknown)(...a)) as PluginApi['userTerms'];
export const tr: PluginApi['tr'] = ((...a: unknown[]) => (live().tr as (...x: unknown[]) => unknown)(...a)) as PluginApi['tr'];
export const t: PluginApi['t'] = ((...a: unknown[]) => (live().t as (...x: unknown[]) => unknown)(...a)) as PluginApi['t'];
export const pushToUser: PluginApi['pushToUser'] = ((...a: unknown[]) => (live().pushToUser as (...x: unknown[]) => unknown)(...a)) as PluginApi['pushToUser'];
export const mailerConfigured: PluginApi['mailerConfigured'] = ((...a: unknown[]) => (live().mailerConfigured as (...x: unknown[]) => unknown)(...a)) as PluginApi['mailerConfigured'];
export const sendTemplateMail: PluginApi['sendTemplateMail'] = ((...a: unknown[]) => (live().sendTemplateMail as (...x: unknown[]) => unknown)(...a)) as PluginApi['sendTemplateMail'];
export const saveFile: PluginApi['saveFile'] = ((...a: unknown[]) => (live().saveFile as (...x: unknown[]) => unknown)(...a)) as PluginApi['saveFile'];
export const filePath: PluginApi['filePath'] = ((...a: unknown[]) => (live().filePath as (...x: unknown[]) => unknown)(...a)) as PluginApi['filePath'];
export const consumeQuota: PluginApi['consumeQuota'] = ((...a: unknown[]) => (live().consumeQuota as (...x: unknown[]) => unknown)(...a)) as PluginApi['consumeQuota'];
export const resolveTier: PluginApi['resolveTier'] = ((...a: unknown[]) => (live().resolveTier as (...x: unknown[]) => unknown)(...a)) as PluginApi['resolveTier'];
export const complete: PluginApi['complete'] = ((...a: unknown[]) => (live().complete as (...x: unknown[]) => unknown)(...a)) as PluginApi['complete'];
export const levelFor: PluginApi['levelFor'] = ((...a: unknown[]) => (live().levelFor as (...x: unknown[]) => unknown)(...a)) as PluginApi['levelFor'];
export const perform: PluginApi['perform'] = ((...a: unknown[]) => (live().perform as (...x: unknown[]) => unknown)(...a)) as PluginApi['perform'];
export const record: PluginApi['record'] = ((...a: unknown[]) => (live().record as (...x: unknown[]) => unknown)(...a)) as PluginApi['record'];
export const hasFeature: PluginApi['hasFeature'] = ((...a: unknown[]) => (live().hasFeature as (...x: unknown[]) => unknown)(...a)) as PluginApi['hasFeature'];
export const isSchool: PluginApi['isSchool'] = ((...a: unknown[]) => (live().isSchool as (...x: unknown[]) => unknown)(...a)) as PluginApi['isSchool'];
export const toMin: PluginApi['toMin'] = ((...a: unknown[]) => (live().toMin as (...x: unknown[]) => unknown)(...a)) as PluginApi['toMin'];
export const toHhmm: PluginApi['toHhmm'] = ((...a: unknown[]) => (live().toHhmm as (...x: unknown[]) => unknown)(...a)) as PluginApi['toHhmm'];
export const assertPublicUrl: PluginApi['assertPublicUrl'] = ((...a: unknown[]) => (live().assertPublicUrl as (...x: unknown[]) => unknown)(...a)) as PluginApi['assertPublicUrl'];
export const fetchText: PluginApi['fetchText'] = ((...a: unknown[]) => (live().fetchText as (...x: unknown[]) => unknown)(...a)) as PluginApi['fetchText'];
