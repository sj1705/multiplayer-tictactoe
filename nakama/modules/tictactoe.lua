local nk = require("nakama")

local LEADERBOARD_ID = "global_leaderboard"

-- Create leaderboard
nk.leaderboard_create(LEADERBOARD_ID, true, "desc", "incr")
nk.logger_info("Tic-Tac-Toe leaderboard created")

-- ========================
-- MATCHMAKER MATCHED
-- ========================
local function matchmaker_matched(context, matched_users)
  local timed_mode = false
  for _, user in ipairs(matched_users) do
    if user.properties and user.properties.timed_mode == 1 then
      timed_mode = true
    end
  end

  local match_id = nk.match_create("tictactoe_match", {timed_mode = timed_mode})
  return match_id
end
nk.register_matchmaker_matched(matchmaker_matched)

-- ========================
-- RPCs
-- ========================
local function rpc_create_match(context, payload)
  local timed_mode = false
  if payload and payload ~= "" then
    local data = nk.json_decode(payload)
    if data and data.timed_mode then
      timed_mode = true
    end
  end

  local match_id = nk.match_create("tictactoe_match", {timed_mode = timed_mode})
  return nk.json_encode({match_id = match_id})
end
nk.register_rpc(rpc_create_match, "create_match")

local function rpc_get_leaderboard(context, payload)
  local limit = 20
  if payload and payload ~= "" then
    local data = nk.json_decode(payload)
    if data and data.limit and data.limit > 0 and data.limit <= 100 then
      limit = data.limit
    end
  end

  local records, owner_records, next_cursor, prev_cursor = nk.leaderboard_records_list(LEADERBOARD_ID, {}, limit)

  local entries = {}
  for _, record in ipairs(records or {}) do
    local stats = {wins = 0, losses = 0, draws = 0, win_streak = 0, max_streak = 0}

    local success, objects = pcall(nk.storage_read, {
      {collection = "stats", key = "player_stats", user_id = record.owner_id}
    })
    if success and objects and #objects > 0 then
      local val = objects[1].value
      if type(val) == "string" then val = nk.json_decode(val) end
      if val then stats = val end
    end

    table.insert(entries, {
      user_id = record.owner_id,
      username = record.username,
      score = record.score,
      rank = record.rank,
      stats = stats,
    })
  end

  return nk.json_encode({entries = entries})
end
nk.register_rpc(rpc_get_leaderboard, "get_leaderboard")

nk.logger_info("Tic-Tac-Toe module initialized successfully")
