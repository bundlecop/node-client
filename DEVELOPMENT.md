Development
-----------

$ yarn run dev
$ yarn run cli -- submit --api-url http://localhost:5000/api


New Release Checklist
---------------------

- Update CHANGES
- git commit that.
- yarn run publish-version
- git commit package.json.
- git tag -a (copy CHANGES entry to message)
- git push && git push --tags
