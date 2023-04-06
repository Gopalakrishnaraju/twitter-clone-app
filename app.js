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
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await db.get(selectUserQuery);
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

// APT 3 get following tweets

app.get(
  "/user/tweets/feed/",
  authenticateJwtToken,
  async (request, response) => {
    const { user } = request;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${user}';`;
    const selectedUser = await db.get(selectUserQuery);
    const { user_id } = selectedUser;
    const getUserFollowsTweetsQuery = `
    SELECT 
        user.username, 
        tweet.tweet, 
        tweet.date_time AS dateTime 
    FROM 
        tweet NATURAL JOIN user 
    WHERE user_id IN (
        SELECT 
            following_user_id 
        FROM follower 
        WHERE follower_user_id = ${user_id}
        )
    ORDER BY tweet.date_time DESC
    LIMIT 4;`;
    const followingTweets = await db.all(getUserFollowsTweetsQuery);
    response.send(followingTweets);
  }
);

// APT 4 get following list

app.get("/user/following/", authenticateJwtToken, async (request, response) => {
  const { user } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${user}';`;
  const selectedUser = await db.get(selectUserQuery);
  const { user_id } = selectedUser;
  const getUserFollowingListQuery = `
    SELECT 
        user.name
    FROM 
        follower INNER JOIN user ON user.user_id = follower.following_user_id
    WHERE
        follower_user_id = ${user_id};`;
  const followingList = await db.all(getUserFollowingListQuery);
  response.send(followingList);
});

// APT 5 get followers list

app.get("/user/followers/", authenticateJwtToken, async (request, response) => {
  const { user } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${user}';`;
  const selectedUser = await db.get(selectUserQuery);
  const { user_id } = selectedUser;
  const getUserFollowersListQuery = `
    SELECT 
        user.name
    FROM 
        follower INNER JOIN user ON user.user_id = follower.follower_user_id
    WHERE
        following_user_id = ${user_id};`;
  const followersList = await db.all(getUserFollowersListQuery);
  response.send(followersList);
});

// APT 6 get tweets from following list

app.get(
  "/tweets/:tweetId/",
  authenticateJwtToken,
  async (request, response) => {
    const { user } = request;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${user}';`;
    const selectedUser = await db.get(selectUserQuery);
    const { user_id } = selectedUser;
    const getUserFollowingListQuery = `
    SELECT 
        user.user_id
    FROM 
        follower INNER JOIN user ON user.user_id = follower.following_user_id
    WHERE
        follower_user_id = ${user_id};`;
    const followingList = await db.all(getUserFollowingListQuery);
    const { tweetId } = request.params;
    const getTweetQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweetUser_id = await db.get(getTweetQuery);
    const followingListArray = followingList.map((eachObject) => {
      return eachObject.user_id;
    });
    if (followingListArray.includes(tweetUser_id.user_id)) {
      const getTweetDetailsQuery = `
      SELECT
        tweet.tweet AS tweet,
        COUNT(DISTINCT like.user_id) AS likes,
        COUNT(DISTINCT reply.reply) AS replies,
        tweet.date_time AS dateTime
      FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
        INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
      WHERE tweet.tweet_id = ${tweetId};`;
      const tweetDetails = await db.get(getTweetDetailsQuery);
      response.send(tweetDetails);
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// APT 7 get tweets likes list

app.get(
  "/tweets/:tweetId/likes/",
  authenticateJwtToken,
  async (request, response) => {
    const { user } = request;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${user}';`;
    const selectedUser = await db.get(selectUserQuery);
    const { user_id } = selectedUser;
    const getUserFollowingListQuery = `
    SELECT 
        user.user_id
    FROM 
        follower INNER JOIN user ON user.user_id = follower.following_user_id
    WHERE
        follower_user_id = ${user_id};`;
    const followingList = await db.all(getUserFollowingListQuery);
    const { tweetId } = request.params;
    const getTweetQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweetUser_id = await db.get(getTweetQuery);
    const followingListArray = followingList.map((eachObject) => {
      return eachObject.user_id;
    });
    if (followingListArray.includes(tweetUser_id.user_id)) {
      const getTweetLikesQuery = `
      SELECT
        like.user_id,
        user.username
      FROM tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
        INNER JOIN user ON user.user_id = like.user_id
      WHERE tweet.tweet_id = ${tweetId};`;
      const tweetLikes = await db.all(getTweetLikesQuery);
      response.send({
        likes: tweetLikes.map((eachObject) => {
          return eachObject.username;
        }),
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// APT 8 get tweets reply list

app.get(
  "/tweets/:tweetId/replies/",
  authenticateJwtToken,
  async (request, response) => {
    const { user } = request;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${user}';`;
    const selectedUser = await db.get(selectUserQuery);
    const { user_id } = selectedUser;
    const getUserFollowingListQuery = `
    SELECT 
        user.user_id
    FROM 
        follower INNER JOIN user ON user.user_id = follower.following_user_id
    WHERE
        follower_user_id = ${user_id};`;
    const followingList = await db.all(getUserFollowingListQuery);
    const { tweetId } = request.params;
    const getTweetQuery = `SELECT user_id FROM tweet WHERE tweet_id = ${tweetId};`;
    const tweetUser_id = await db.get(getTweetQuery);
    const followingListArray = followingList.map((eachObject) => {
      return eachObject.user_id;
    });
    if (followingListArray.includes(tweetUser_id.user_id)) {
      const getTweetReplyQuery = `
      SELECT
        user.name,
        reply.reply
      FROM tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
        INNER JOIN user ON user.user_id = reply.user_id
      WHERE tweet.tweet_id = ${tweetId};`;
      const tweetReplay = await db.all(getTweetReplyQuery);
      response.send({
        replies: tweetReplay.map((eachObject) => {
          return eachObject;
        }),
      });
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

// APT 9 get tweets reply list

app.get("/user/tweets/", authenticateJwtToken, async (request, response) => {
  const { user } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${user}';`;
  const selectedUser = await db.get(selectUserQuery);
  const { user_id } = selectedUser;
  const getUserTweetsListQuery = `
        SELECT
            tweet.tweet,
            COUNT(DISTINCT like.user_id) AS likes,
            COUNT(DISTINCT reply.reply) AS replies,
            tweet.date_time AS dateTime
        FROM 
            tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
            INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
        WHERE 
            tweet.user_id = ${user_id}
        GROUP BY tweet.tweet_id;`;
  const tweetsList = await db.all(getUserTweetsListQuery);
  response.send(tweetsList);
});

// APT 10 post tweet

app.post("/user/tweets/", authenticateJwtToken, async (request, response) => {
  const { user } = request;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${user}';`;
  const selectedUser = await db.get(selectUserQuery);
  const { user_id } = selectedUser;
  const { tweet } = request.body;
  const createPostQuery = `
        INSERT INTO tweet(tweet, user_id)
        VALUES('${tweet}', ${user_id});`;
  await db.run(createPostQuery);
  response.send("Created a Tweet");
});

//API 11 delete tweet

app.delete(
  "/tweets/:tweetId/",
  authenticateJwtToken,
  async (request, response) => {
    const { user } = request;
    const selectUserQuery = `SELECT * FROM user WHERE username = '${user}';`;
    const selectedUser = await db.get(selectUserQuery);
    const { user_id } = selectedUser;
    const getUserTweetsQuery = `
    SELECT 
        tweet_id
    FROM 
        tweet
    WHERE
        user_id = ${user_id};`;
    const tweetsList = await db.all(getUserTweetsQuery);
    const { tweetId } = request.params;
    const tweetsListArray = tweetsList.map((eachObject) => {
      return eachObject.tweet_id;
    });
    if (tweetsListArray.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `
      DELETE FROM
        tweet
      WHERE tweet_id = ${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
