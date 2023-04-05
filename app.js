const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let db = null;

const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

const authenticateJwtToken = async (request, response, next) => {
  const authHeader = request.headers["authorization"];
  let jwtToken;
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    await jwt.verify(jwtToken, "ounaodoifj", (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        const { username, userId } = payload;
        request.user = username;
        next();
      }
    });
  }
};

// API 1 Create user

app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const createUserQuery = `INSERT INTO 
      user(name, username, password, gender)
      VALUES('${name}', '${username}', '${hashedPassword}', '${gender}');`;
      await db.run(createUserQuery);
      response.send("User created successfully");
    }
  }
});

// APT 2 User Login

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT username, user_id FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
  const userId = dbUser.user_id;
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch) {
      const payload = { username: username };
      const jwtToken = await jwt.sign(payload, "ounaodoifj");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// APT 3 User Login

app.get(
  "/user/tweets/feed/",
  authenticateJwtToken,
  async (request, response) => {
    let { user } = request;
    console.log(user);
    console.log(userId);
    const getUserFollowsTweetsQuery = `
    SELECT 
      user.username,
      tweet.tweet,
      tweet.date_time AS dateTime
    FROM 
      user LEFT JOIN tweet ON user.user_id = tweet.user_id
      LEFT JOIN follower ON tweet.user_id = follower_user_id
    WHERE 
      user.username = '${user}' 
      AND
      follower.following_user_id IN (
          SELECT following_user_id FROM follower
      )

    `;
  }
);
