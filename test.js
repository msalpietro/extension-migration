const contentful = require('contentful-management');
const Promise = require('bluebird');
const get = require('lodash/get');

require('dotenv').config();

const client = contentful.createClient({
  accessToken: process.env.MANAGEMENT_TOKEN,
});

const linkFields = {
  container: ['sections'],
  sectionTable: ['columns'],
  itemColumn: ['cells'],
};

// get ids of linked entries defined in linkFields
const getLinkedIds = entries => entries.reduce((x, entry) => {
  const contentType = entry.sys.contentType.sys.id;
  return Object.entries(entry.fields).reduce((y, [key, value]) => (
    get(linkFields, contentType, []).includes(key) ? [...y, ...value['en-US'].map(i => i.sys.id)] : y
  ), x);
}, []);

// recursive get all linked entries
const getLinks = async ({ space, entries = [], links = [] }) => {
  const ids = getLinkedIds(entries);
  if (ids.length > 0) {
    const linkedEntries = await space.getEntries({ 'sys.id[in]': ids.join(',') }).then(x => x.items);
    return getLinks({ space, entries: linkedEntries, links: [...links, ...linkedEntries] });
  } else {
    return links;
  }
}

// get ids of all localized text fields
const getLocalizedFields = fields => fields.filter(field => (
  ['Symbol', 'Text'].includes(field.type) && field.localized === true
)).map(field => field.id);

// for all localized fields copy english to locale if empty
const copyFields = (entry, locale, localizedFields = []) => Object.entries(entry.fields).reduce((x, [key, value]) => {
  if (localizedFields.includes(key)) {
    const englishValue = get(value, 'en-US');
    const localeValue = get(value, locale);
    const field = { [key]: Object.assign(value, (englishValue && !localeValue ? { [locale]: englishValue } : {})) };
    return Object.assign(x, Object.assign(x.fields, field));
  }
  return x;
}, Object.assign({}, entry));

const run = async () => {
  try {
    const space = await client.getSpace(process.env.EXPORT_SPACE);

    const contentTypes = await space.getContentTypes().then(x => x.items);

    const localizedFields = contentTypes.reduce((x, ct) => (
      Object.assign(x, { [get(ct, 'sys.id')]: getLocalizedFields(ct.fields) })
    ), {});

    const entry = await space.getEntry('6GaEzpzZjqc4qC244cEAsW');

    let allLinks = await getLinks({ space, entries: [entry] })
      .then(links => (
        links.map(link => copyFields(link, 'ja-JP', localizedFields[get(link, 'sys.contentType.sys.id')]))
      ));

    allLinks = await Promise.all(allLinks.map(link => space.updateEntry(link));

    console.log(allLinks.length);
  } catch (error) {
    console.log(error);
  }
}

run();
