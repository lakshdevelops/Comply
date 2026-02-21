backend/
  app/
    main.py
    core/
      config.py
      logging.py
      security.py          # auth verification (Firebase) + deps
    api/
      deps.py              # shared FastAPI dependencies
      router.py            # include all routers here
      v1/
        auth.py            # /me, login helpers if needed
        clients.py         # client workspaces CRUD
        github.py          # connect/install webhook endpoints, repo listing
        docs.py            # upload docs, list docs
        runs.py            # start agent run, get status/results
    services/
      users_service.py     # user upsert, user fetch
      clients_service.py   # workspace logic
      github_service.py    # call GitHub APIs (later)
      docs_service.py      # store + retrieve docs
      agent_service.py     # run “agent” pipeline (stub first)
    models/
      user.py
      client.py
      integration.py       # github installation mapping
      doc.py
      run.py
    db/
      base.py
      session.py
      init_db.py
      crud.py              # optional, keep light
    schemas/
      user.py
      client.py
      github.py
      doc.py
      run.py
    utils/
      ids.py
      time.py
  tests/
    test_auth.py
    test_clients.py
  requirements.txt
  Dockerfile
  .env.example