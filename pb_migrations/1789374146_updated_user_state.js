/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3219200307")

  // update collection data
  unmarshal({
    "listRule": "owner = @request.auth.id"
  }, collection)

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3219200307")

  // update collection data
  unmarshal({
    "listRule": null
  }, collection)

  return app.save(collection)
})
