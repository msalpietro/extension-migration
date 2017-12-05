const contentful = require('contentful-management');
const Promise = require('bluebird');

require('dotenv').config();

const client = contentful.createClient({
  accessToken: process.env.MANAGEMENT_TOKEN,
});

const importExtensions = ({ importSpace, exportedExtensions, existingExtensions }) => (
  exportedExtensions.map((exported) => {
    const existing = existingExtensions.find(x => x.sys.id === exported.sys.id);
    if (existing) {
      existing.extension = exported.extension;
      return existing.update()
        .then((x) => `${x.sys.id} - extension updated`)
        .catch((error) => `${exported.sys.id} - error updating extension - ${error.name}`);
    }
    return importSpace.createUiExtensionWithId(exported.sys.id, exported)
      .then((x) => `${x.sys.id} - extension created`)
      .catch((error) => `${exported.sys.id} - error creating extension - ${error.name}`);
  })
);

const migrateExtensions = async () => {
  const [exportSpace, importSpace] = await Promise.all([
    client.getSpace(process.env.EXPORT_SPACE),
    client.getSpace(process.env.IMPORT_SPACE),
  ]);

  try {
    const exportedExtensions = await exportSpace.getUiExtensions().then(x => x.items);
    const existingExtensions = await importSpace.getUiExtensions().then(x => x.items);

    const importedExtensions = await Promise.all(importExtensions({
      importSpace,
      exportedExtensions,
      existingExtensions
    }));

    return importedExtensions;
  } catch (error) {
    console.log(error);
  }
}

migrateExtensions()
  .then(importedExtensions => console.log(importedExtensions))
  .catch(error => console.error(error));
