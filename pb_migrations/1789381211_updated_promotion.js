/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_2771819337")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.role='franchise_owner' || @request.auth.role='admin' || @request.auth.role='superadmin'"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_2771819337")

  // update collection data
  unmarshal({
    "createRule": "@request.auth.id != ''"
  }, collection)

  return app.save(collection)
})
