const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
//
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
//
const app = express();
//
app.use(express.json());
let db = null;
//
const initializeAndDbServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is started at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`DB error ${error.message}`);
    process.exit(1);
  }
};
initializeAndDbServer();
//authenticate
const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};
//state function.
const convertStateDbObject = (dbObject) => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  };
};
//district function
const convertDistrictDbObject = (dbObject) => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  };
};
//api-1.
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const postQuery = `
    SELECT
      *
    FROM
      user
    WHERE
      username = '${username}';`;
  const dbUser = await db.get(postQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "MY_SECRET_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
//api-2
app.get("/states/", authenticateToken, async (request, response) => {
  const getStatesQuery = `
    SELECT
      *
    FROM
      state;`;
  const getStates = await db.all(getStatesQuery);
  response.send(getStates.map((eachState) => convertStateDbObject(eachState)));
});
//api-3
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const getStatesQuery = `
    SELECT
      *
    FROM
      state
    WHERE
      state_id = ${stateId};`;
  const getStates = await db.get(getStatesQuery);
  console.log(getStates);
  response.send(convertStateDbObject(getStates));
});
//api-4
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const getDistrict = `
    INSERT INTO
      district (district_name, state_id, cases, cured, active, deaths)
    VALUES
      ('${districtName}', ${stateId}, ${cases}, ${cured}, ${active}, ${deaths});`;
  await db.run(getDistrict);
  response.send("District Successfully Added");
});
//api-5
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    SELECT
      *
    FROM
      district
    WHERE
      district_id = ${districtId};`;
    const getDistrict = await db.get(getDistrictQuery);
    response.send(convertDistrictDbObject(getDistrict));
  }
);
//api-6
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const getDistrictQuery = `
    DELETE FROM
      district
    WHERE
      district_id = ${districtId};`;
    await db.run(getDistrictQuery);
    response.send("District Removed");
  }
);
//api-7
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const getDistrictQuery = `
            UPDATE
              district
            SET
              district_name = '${districtName}',
              state_id = ${stateId},
              cases = ${cases},
              cured = ${cured},
              active = ${active},
              deaths = ${deaths}
            WHERE
              district_id = ${districtId};`;
    await db.run(getDistrictQuery);
    response.send("District Details Updated");
  }
);
//api-8
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStats = `
    SELECT
      SUM(cases), SUM(cured), SUM(active), SUM(deaths)
    FROM
      district
    WHERE
      state_id = ${stateId};`;
    const stats = await db.get(getStateStats);
    console.log(stats);
    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
//
module.exports = app;
