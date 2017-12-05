require('dotenv').config({ path: '../.env' });
const contentful = require('contentful-management');
const Promise = require('bluebird');
const get = require('lodash/get');

const client = contentful.createClient({
  accessToken: process.env.MANAGEMENT_TOKEN,
});

const merge = (existing, exported) => Object.assign(existing, exported, { sys: existing.sys });
const match = (existing, exported, key = 'sys.id') => existing.find(x => get(x, key) === get(exported, key));

const importItems = ({ importSpace, exportedItems, existingItems }) => (
  exportedItems.map((exportedItem) => {
    const existingItem = match(existingItems, exportedItem);
    if (existingItem) {
      const updatedItem = merge(existingItem, exportedItem);
      return updatedItem.update()
        .then((x) => x.publish())
        .then((x) => (console.log(`${x.sys.id} - updated`), x))
        .catch((error) => console.log(`${exported.sys.id} - error updating - ${error.name}`, false));
    }
    return importSpace.createContentTypeWithId(exportedItem.sys.id, exportedItem)
      .then((x) => x.publish())
      .then((x) => (console.log(`${x.sys.id} - created`), x))
      .catch((error) => console.log(`${exported.sys.id} - error creating - ${error.name}`, false));
  })
);

const importEditorInterfaces = async ({ importSpace, exportedItems, importedItems }) => {
  const idKey = 'sys.contentType.sys.id';
  const [exportedInterfaces, importedInterfaces] = await Promise.all([
    Promise.all(exportedItems.map(x => x.getEditorInterface())),
    Promise.all(importedItems.reduce((acc, x) => (x && [...acc, x.getEditorInterface() ]), [])),
  ]);

  return Promise.all(importedInterfaces.map((item) => {
    const exportedInterface = match(exportedInterfaces, item, idKey);
    if (exportedInterface) {
      const updated = merge(item, exportedInterface);
      return updated.update()
        .then(x => (console.log(`${get(x, idKey)} - interface updated`), x))
        .catch((error) => (console.log(`${get(item, idKey)} - error creating - ${error.name}`), false));
    }
    return item;
  }));
}

const migrate = async () => {
  const [exportSpace, importSpace] = await Promise.all([
    client.getSpace(process.env.EXPORT_SPACE),
    client.getSpace(process.env.IMPORT_SPACE),
  ]);

  const query = {
    'sys.id[in]': process.argv.slice(2).join(','),
  };

  try {
    const [exportedItems, existingItems] = await Promise.all([
      exportSpace.getContentTypes(query).then(x => x.items),
      importSpace.getContentTypes(query).then(x => x.items),
    ]);

    const importedItems = await Promise.all(importItems({
      importSpace,
      exportedItems,
      existingItems,
    }));

    const updatedInterfaces = await importEditorInterfaces({
      importSpace,
      exportedItems,
      importedItems,
    });

    return true;
  } catch (error) {
    console.log(error);
  }
}

migrate();
  // .catch(error => console.error(error));
