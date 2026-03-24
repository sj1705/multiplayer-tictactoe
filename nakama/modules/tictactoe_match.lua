local nk = require("nakama")

-- Constants
local TURN_TIMEOUT = 30
local WIN_SCORE = 200
local DRAW_SCORE = 50
local LOSS_SCORE = 10
local LEADERBOARD_ID = "global_leaderboard"

-- OpCodes
local OP_MOVE = 1
local OP_STATE = 2
local OP_GAME_OVER = 3
local OP_TIMER_UPDATE = 4
local OP_ERROR = 5

-- Win lines (1-indexed for Lua)
local WIN_LINES = {
  {1, 2, 3}, {4, 5, 6}, {7, 8, 9},
  {1, 4, 7}, {2, 5, 8}, {3, 6, 9},
  {1, 5, 9}, {3, 5, 7},
}

-- ========================
-- HELPER FUNCTIONS
-- ========================
local function check_win(board)
  for _, line in ipairs(WIN_LINES) do
    local a, b, c = line[1], line[2], line[3]
    if board[a] ~= 0 and board[a] == board[b] and board[b] == board[c] then
      return board[a], {a - 1, b - 1, c - 1}
    end
  end
  return 0, {}
end

local function is_board_full(board)
  for i = 1, 9 do
    if board[i] == 0 then return false end
  end
  return true
end

local function table_count(t)
  local count = 0
  for _ in pairs(t) do count = count + 1 end
  return count
end

local function broadcast_state(state, dispatcher)
  local board_out = {}
  for i = 1, 9 do
    board_out[i] = state.board[i]
  end

  local msg = {
    board = board_out,
    players = state.players,
    player_names = state.player_names,
    current_turn = state.current_turn,
    game_over = state.game_over,
    winner = state.winner,
    win_line = state.win_line,
    timed_mode = state.timed_mode,
    turn_deadline = state.turn_deadline,
  }
  dispatcher.broadcast_message(OP_STATE, nk.json_encode(msg))
end

local function update_leaderboard(state)
  for user_id, _ in pairs(state.players) do
    local score = 0
    local stats = {wins = 0, losses = 0, draws = 0, win_streak = 0, max_streak = 0}

    local success, objects = pcall(nk.storage_read, {
      {collection = "stats", key = "player_stats", user_id = user_id}
    })
    if success and objects and #objects > 0 then
      local val = objects[1].value
      if type(val) == "string" then val = nk.json_decode(val) end
      if val then stats = val end
    end

    if state.winner == "" then
      score = DRAW_SCORE
      stats.draws = (stats.draws or 0) + 1
      stats.win_streak = 0
    elseif state.winner == user_id then
      score = WIN_SCORE
      stats.wins = (stats.wins or 0) + 1
      stats.win_streak = (stats.win_streak or 0) + 1
      if stats.win_streak > (stats.max_streak or 0) then
        stats.max_streak = stats.win_streak
      end
    else
      score = LOSS_SCORE
      stats.losses = (stats.losses or 0) + 1
      stats.win_streak = 0
    end

    pcall(nk.leaderboard_record_write, LEADERBOARD_ID, user_id, nil, score)

    pcall(nk.storage_write, {
      {
        collection = "stats",
        key = "player_stats",
        user_id = user_id,
        value = stats,
        permission_read = 2,
        permission_write = 0,
      }
    })
  end
end

-- ========================
-- MATCH HANDLER
-- ========================
local M = {}

function M.match_init(context, params)
  local timed_mode = false
  if params and params.timed_mode then
    timed_mode = true
  end

  local state = {
    board = {0, 0, 0, 0, 0, 0, 0, 0, 0},
    players = {},
    player_names = {},
    current_turn = "",
    game_over = false,
    winner = "",
    win_line = {},
    timed_mode = timed_mode,
    turn_deadline = 0,
    started = false,
    presences = {},
    empty_ticks = 0,
    player_count = 0,
  }

  local tick_rate = 1
  local label = nk.json_encode({timed_mode = timed_mode, open = true, players = 0})

  return state, tick_rate, label
end

function M.match_join_attempt(context, dispatcher, tick, state, presence, metadata)
  if state.player_count >= 2 and not state.players[presence.user_id] then
    return state, false, "match is full"
  end
  if state.game_over then
    return state, false, "match is over"
  end
  return state, true
end

function M.match_join(context, dispatcher, tick, state, presences)
  for _, p in ipairs(presences) do
    local user_id = p.user_id

    if state.players[user_id] then
      state.presences[user_id] = p
    else
      local mark = 1
      if state.player_count == 1 then
        mark = 2
      end

      state.players[user_id] = mark
      state.presences[user_id] = p
      state.player_count = state.player_count + 1

      local account = nk.account_get_id(user_id)
      local name = user_id:sub(1, 8)
      if account and account.user then
        if account.user.display_name and account.user.display_name ~= "" then
          name = account.user.display_name
        elseif account.user.username and account.user.username ~= "" then
          name = account.user.username
        end
      end
      state.player_names[user_id] = name

      if mark == 1 then
        state.current_turn = user_id
      end

      nk.logger_info(string.format("Player %s (%s) joined as %s", name, user_id, mark == 1 and "X" or "O"))
    end
  end

  if state.player_count == 2 and not state.started then
    state.started = true
    if state.timed_mode then
      state.turn_deadline = nk.time() + TURN_TIMEOUT * 1000
    end

    local label = nk.json_encode({timed_mode = state.timed_mode, open = false, players = 2})
    dispatcher.match_label_update(label)
    broadcast_state(state, dispatcher)
  end

  return state
end

function M.match_leave(context, dispatcher, tick, state, presences)
  for _, p in ipairs(presences) do
    state.presences[p.user_id] = nil
    nk.logger_info(string.format("Player %s left", p.user_id))
  end

  local presence_count = table_count(state.presences)

  if state.started and not state.game_over and presence_count < 2 then
    state.game_over = true
    state.winner = ""

    for uid, _ in pairs(state.presences) do
      state.winner = uid
    end

    local msg = {
      winner = state.winner,
      winner_name = state.player_names[state.winner] or "",
      win_line = nk.json_encode({}),
      reason = "forfeit",
    }
    dispatcher.broadcast_message(OP_GAME_OVER, nk.json_encode(msg))
    update_leaderboard(state)
  end

  if presence_count == 0 then
    return nil
  end

  return state
end

function M.match_loop(context, dispatcher, tick, state, messages)
  local presence_count = table_count(state.presences)

  if presence_count == 0 then
    state.empty_ticks = state.empty_ticks + 1
    if state.empty_ticks > 30 then return nil end
    return state
  end
  state.empty_ticks = 0

  if state.game_over or not state.started then
    return state
  end

  -- Timer check
  if state.timed_mode and state.turn_deadline > 0 then
    local now = nk.time()
    if now >= state.turn_deadline then
      state.game_over = true
      for uid, _ in pairs(state.players) do
        if uid ~= state.current_turn then
          state.winner = uid
          break
        end
      end

      local msg = {
        winner = state.winner,
        winner_name = state.player_names[state.winner] or "",
        win_line = nil,
        reason = "timeout",
      }
      dispatcher.broadcast_message(OP_GAME_OVER, nk.json_encode(msg))
      update_leaderboard(state)
      return state
    end

    dispatcher.broadcast_message(OP_TIMER_UPDATE, nk.json_encode({
      deadline = state.turn_deadline,
      now = now,
    }))
  end

  -- Process moves
  for _, msg in ipairs(messages) do
    if msg.op_code == OP_MOVE then
      local user_id = msg.sender.user_id

      if user_id ~= state.current_turn then
        if state.presences[user_id] then
          dispatcher.broadcast_message(OP_ERROR,
            nk.json_encode({error = "not your turn"}),
            {state.presences[user_id]})
        end
      else
        local data = nk.json_decode(msg.data)
        local pos = data.position

        if pos == nil or pos < 0 or pos > 8 then
          dispatcher.broadcast_message(OP_ERROR,
            nk.json_encode({error = "position out of range"}),
            {state.presences[user_id]})
        elseif state.board[pos + 1] ~= 0 then
          dispatcher.broadcast_message(OP_ERROR,
            nk.json_encode({error = "cell already occupied"}),
            {state.presences[user_id]})
        else
          state.board[pos + 1] = state.players[user_id]

          local winner, win_line = check_win(state.board)
          if winner ~= 0 then
            state.game_over = true
            state.win_line = win_line
            for uid, mark in pairs(state.players) do
              if mark == winner then
                state.winner = uid
                break
              end
            end

            broadcast_state(state, dispatcher)

            local game_over_msg = {
              winner = state.winner,
              winner_name = state.player_names[state.winner] or "",
              win_line = win_line,
              reason = "win",
            }
            dispatcher.broadcast_message(OP_GAME_OVER, nk.json_encode(game_over_msg))
            update_leaderboard(state)
            return state
          end

          if is_board_full(state.board) then
            state.game_over = true
            state.winner = ""

            broadcast_state(state, dispatcher)

            local game_over_msg = {
              winner = "",
              winner_name = "",
              win_line = {},
              reason = "draw",
            }
            dispatcher.broadcast_message(OP_GAME_OVER, nk.json_encode(game_over_msg))
            update_leaderboard(state)
            return state
          end

          for uid, _ in pairs(state.players) do
            if uid ~= state.current_turn then
              state.current_turn = uid
              break
            end
          end

          if state.timed_mode then
            state.turn_deadline = nk.time() + TURN_TIMEOUT * 1000
          end

          broadcast_state(state, dispatcher)
        end
      end
    end
  end

  return state
end

function M.match_terminate(context, dispatcher, tick, state, grace_seconds)
  return nil
end

function M.match_signal(context, dispatcher, tick, state, data)
  return state, ""
end

return M
