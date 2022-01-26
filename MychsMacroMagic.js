// Mych's Macro Magic by Michael Buschbeck <michael@buschbeck.net> (2021)
// https://github.com/michael-buschbeck/mychs-macro-magic/blob/main/LICENSE

const MMM_VERSION = "1.26.3";

const MMM_STARTUP_INSTANCE = MMM_VERSION + "/" + new Date().toISOString();
const MMM_STARTUP_SENDER = "MMM-f560287b-c9a0-4273-bf03-f2c1f97d24d4";

on("ready", function()
{
    let msecStart = new Date().getTime();

    // activate this instance and shut down all lingering ones in previous sandbox instances
    sendChat(MMM_STARTUP_SENDER, "!mmm startup " + MMM_STARTUP_INSTANCE, null, {noarchive: true});

    let macros = [];
    
    for (let macroObj of findObjs({ type: "macro" }))
    {
        let macroName = macroObj.get("name");
        let macroText = macroObj.get("action");

        if (/^!mmm[-_]autorun/ui.test(macroName))
        {
            let playerid = macroObj.get("playerid");
            let playerIsPrivileged = MychScriptContext.$isPrivileged(playerid);

            let macro =
            {
                playerid: playerid,
                privileged: playerIsPrivileged,
                name: macroName,
                text: macroText,
            };

            macros.push(macro);
        }
    }

    function compareMacros(macroA, macroB)
    {
        if (macroA.privileged != macroB.privileged)
        {
            return (macroA.privileged ? -1 : 0) - (macroB.privileged ? -1 : 0);
        }

        return (macroA.name < macroB.name) ? -1
             : (macroA.name > macroB.name) ? +1 : 0;
    }

    macros.sort(compareMacros);

    for (let macro of macros)
    {
        let playerObj = getObj("player", macro.playerid);
        let playerName = playerObj ? playerObj.get("displayname") : macro.playerid;

        let macroDescription = macro.name + " (owner: " + playerName + ", privileged: " + macro.privileged + ")";

        let impersonation =
        {
            playerid: macro.playerid,
            selected: [],
        };

        let sender = "player|" + macro.playerid;

        let msecElapsed = new Date().getTime() - msecStart;
        log("MMM [" + MMM_STARTUP_INSTANCE + "] (+" + msecElapsed + "ms) enqueued autorun macro: " + macroDescription);

        function startAutorunMacro()
        {
            let msecElapsed = new Date().getTime() - msecStart;
            log("MMM [" + MMM_STARTUP_INSTANCE + "] (+" + msecElapsed + "ms) started autorun macro: " + macroDescription);
        }

        function completeAutorunMacro()
        {
            let msecElapsed = new Date().getTime() - msecStart;
            log("MMM [" + MMM_STARTUP_INSTANCE + "] (+" + msecElapsed + "ms) completed autorun macro: " + macroDescription);
        }

        sendChat(sender, "/direct MMM starts executing autorun macro: " + macroDescription, startAutorunMacro);
        MychScriptContext.$sendChatWithImpersonation(sender, macro.text, impersonation);
        sendChat(sender, "/direct MMM completes executing autorun macro: " + macroDescription, completeAutorunMacro);
    }

    // update cached player-privileged state at regular intervals
    setInterval(MychScriptContext.$refreshPlayerIsPrivileged, 60*1000);
});

on("change:player", function(playerObj)
{
    // refresh cached player-privileged state on login, logout, and other occasions
    MychScriptContext.$refreshPlayerIsPrivileged(playerObj.id);
});

on("chat:message", function(msg)
{
    if (msg.playerid == "API" && msg.who == MMM_STARTUP_SENDER)
    {
        let startupSource = msg.content;

        let startupRegExp = /^(?<command>!mmm\s+startup\s*)(?<arguments>.+)?$/u;
        let startupMatch = startupRegExp.exec(startupSource);
    
        if (startupMatch)
        {
            let startupInstance = startupMatch.groups.arguments;

            if (startupInstance == MMM_STARTUP_INSTANCE)
            {
                log("MMM [" + MMM_STARTUP_INSTANCE + "] starting up");
                MychScriptContext.running = true;
            }
            else
            {
                log("MMM [" + MMM_STARTUP_INSTANCE + "] shutting down on startup of MMM [" + startupInstance + "]");
                MychScriptContext.running = false;
            }

            return;
        }
    }

    if (!MychScriptContext.running)
    {
        return;
    }

    if (msg.playerid == "API" && MychScriptContext.impersonation)
    {
        msg.playerid = MychScriptContext.impersonation.playerid;
        msg.selected = MychScriptContext.impersonation.selected.map(id => findObjs({ id: id })).flat().map(obj => ({ _id: obj.get("id"), _type: obj.get("type") }));

        if (msg.selected.length == 0)
        {
            msg.selected = undefined;
        }
    }

    let player = MychScriptContext.players[msg.playerid];

    if (!player)
    {
        player =
        {
            lastseen: undefined,
            context: new MychScriptContext(),
            script: undefined,
            globals: new MychProperties(MychScriptContext.globals),
            customizations: undefined,
            exception: undefined,
        };

        MychScriptContext.players[msg.playerid] = player;
    }

    let msgContext = new MychScriptContext();
    let msgContextHasRolls = false;

    player.lastseen = new Date();

    if (msg.type == "rollresult")
    {
        let rolls =
        [{
            results: JSON.parse(msg.content),
            expression: msg.origRoll,
        }];

        msgContext.$consumeRolls(rolls);
        msgContextHasRolls = true;
    }
    else if (msg.inlinerolls && msg.inlinerolls.length > 0)
    {
        msgContext.$consumeRolls(msg.inlinerolls);
        msgContextHasRolls = true;
    }

    msgContext.selected = msg.selected ? msg.selected.map(entry => entry._id) : [];

    msgContext.sender = msg.who;
    msgContext.playerid = msg.playerid;

    if (msgContextHasRolls || msgContext.sender != player.context.sender || String(msgContext.selected) != String(player.context.selected))
    {
        if (!msgContextHasRolls)
        {
            msgContext.$cloneRolls(player.context);
            msgContextHasRolls = true;
        }

        player.context = msgContext;
    }

    if (msg.type != "api")
    {
        return;
    }

    let statusSource = msg.content;

    let statusRegExp = /^(?<command>!mmm\s+status\s*)(?<arguments>.+)?$/u;
    let statusMatch = statusRegExp.exec(statusSource);

    if (statusMatch)
    {
        let statusSourceOffset = statusMatch.groups.command.length;

        try
        {
            let [statusResetSourceOffset, statusResetArgs] = MychScript.parseTokens([ "reset" ], statusSource, statusSourceOffset);

            if (statusResetArgs)
            {
                if (statusResetSourceOffset < statusSource.length)
                {
                    throw new MychScriptError("parse", "syntax error", statusSource, statusResetSourceOffset);
                }

                player.context.$statusReset();
                return;
            }

            if (statusSourceOffset < statusSource.length)
            {
                throw new MychScriptError("parse", "syntax error", statusSource, statusSourceOffset);
            }

            player.context.$statusDump();
            return;
        }
        catch (exception)
        {
            player.context.error(exception);
            return;
        }
    }

    let msgContentLines = msg.content.split(/<br\/>\s+/u);

    for (let msgContentLine of msgContentLines)
    {
        let scriptMatch = /^!mmm(?![\p{L}\p{N}_])(\s*|\s(?<command>.+))$/u.exec(msgContentLine);

        if (!scriptMatch || !scriptMatch.groups.command)
        {
            continue;
        }

        let scriptCommandTokens = scriptMatch.groups.command;

        try
        {
            let scriptMain = (player.script || new MychScript());
            let scriptAdded = scriptMain.addCommand(scriptCommandTokens, player.context);

            if (!player.script)
            {
                player.script = scriptAdded;
                player.exception = undefined;
            }
            else if (scriptAdded.type == "script" && !scriptAdded.complete)
            {
                player.script = scriptAdded;
                player.customizations = undefined;
                player.exception = undefined;
            }
            else if (scriptAdded.type == "customize" && !scriptAdded.complete)
            {
                player.script = scriptAdded;
                player.customizations = undefined;
                player.exception = undefined;
            }
        }
        catch (exception)
        {
            player.context.error(exception);
            player.exception = exception;

            if (!player.script)
            {
                // top-level script that failed to parse consumes customization stack
                player.customizations = undefined;
            }
        }

        if (player.script && player.script.complete)
        {
            let [script, scriptException] = [player.script, player.exception];

            player.script = undefined;
            player.exception = undefined;

            if (scriptException)
            {
                continue;
            }

            if (script.type == "customize")
            {
                player.customizations || (player.customizations = new MychScript().addCommand("$customizations", player.context));
                player.customizations.nestedScripts.push(script);
            }
            else
            {
                let scriptCustomizations = player.customizations;

                player.customizations = undefined;

                if (scriptCustomizations)
                {
                    scriptCustomizations.nestedScripts.push(script);
                    script = scriptCustomizations;
                }

                let scriptVariables = new MychScriptVariables(player.globals);

                if (script.type == "set")
                {
                    let variableName = script.definition.variable;
                    player.context.whisperback("\u26A0\uFE0F Value of <strong>" + variableName + "</strong> won't survive being <strong>set</strong> outside of a <strong>script</strong> block");
                }

                script.startExecute(scriptVariables);

                if (script.type == "function")
                {
                    let functionName = script.definition.functionName;
                    let functionImpl = scriptVariables.$getProperty(functionName, undefined, false);

                    player.globals.$setProperty(functionName, functionImpl);
                }
            }
        }
    }
});

class MychProperties
{
    constructor(parentProperties = undefined)
    {
        this.$parentProperties = parentProperties;
    }

    $isValidPropertyKey(key)
    {
        return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(key);
    }

    $getProperty(key, fallbackProperties, bindFunctionToProperties)
    {
        for (let properties = this; properties; properties = properties.$parentProperties)
        {
            if (properties.$isValidPropertyKey(key) && key in properties)
            {
                let value = properties[key];
    
                if (bindFunctionToProperties && value instanceof Function && !value.hasBoundVariables)
                {
                    let variables = this;

                    function functionImplWithVariables(...args)
                    {
                        return value.apply(variables, args);
                    }

                    functionImplWithVariables.functionName = value.functionName || value.name;
                    functionImplWithVariables.functionParamCount = value.functionParamCount || value.length;
                    functionImplWithVariables.functionParamNames = value.functionParamNames;
                    functionImplWithVariables.boundVariables = variables;
                    functionImplWithVariables.hasBoundVariables = true;

                    return functionImplWithVariables;
                }
    
                return value;
            }
        }

        if (fallbackProperties)
        {
            return fallbackProperties.$getProperty(key, undefined, bindFunctionToProperties);
        }

        return undefined;
    }

    $setProperty(key, value)
    {
        if (this.$isValidPropertyKey(key))
        {
            this[key] = value;
        }
    }

    $removeProperty(key)
    {
        if (this.$isValidPropertyKey(key))
        {
            delete this[key];
        }
    }
}

class MychScriptContext extends MychProperties
{
    static globals = new MychProperties();
    static players = {};
    static impersonation = undefined;

    $isValidPropertyKey(key)
    {
        return super.$isValidPropertyKey(key) || /^\$\[\[\d+\]\]$/u.test(key);
    }

    version = MMM_VERSION;
    playerid = undefined;
    sender = undefined;
    selected = [];

    pi = Math.PI;

    default = new MychScriptContext.Default();
    denied = new MychScriptContext.Denied();
    unknown = new MychScriptContext.Unknown();

    static Default = class
    {
        toScalar()
        {
            return undefined;
        }

        toMarkup()
        {
            let label = "default";
            let style = "background: gray; border: 2px solid gray; color: white; font-weight: bold";

            return "<span style=\"" + style + "\">" + label + "</span>";
        }
    }

    static DiagnosticUndef = class
    {
        constructor(reason = undefined)
        {
            this.reason = reason;
        }

        toScalar()
        {
            return undefined;
        }

        toMarkup()
        {
            let style = "background: " + this.backColor + "; border: 2px solid " + this.backColor + "; color: " + this.textColor + "; font-weight: bold";
            
            if (this.reason == undefined)
            {
                return "<span class=\"mmm-" + this.label + "\" style=\"" + style + "\">" + this.label + "</span>";
            }
        
            let tooltip = this.reason.replace(/"/ug, "&quot;");
            return "<span class=\"mmm-" + this.label + " showtip tipsy-n-right\" title=\"" + tooltip + "\" style=\"" + style + "; cursor: help\">" + this.label + "</span>";
        }
    }

    static Unknown = class extends MychScriptContext.DiagnosticUndef
    {
        label = "unknown";

        backColor = "darkorange";
        textColor = "white";
    }

    static Denied = class extends MychScriptContext.DiagnosticUndef
    {
        label = "denied";

        backColor = "red";
        textColor = "white";
    }

    isdefault(value)
    {
        if (value instanceof MychScriptContext.Default)
        {
            return true;
        }

        if (value && value.toScalar instanceof Function)
        {
            return this.isdefault(value.toScalar());
        }

        return false;
    }

    isunknown(value)
    {
        if (value instanceof MychScriptContext.Unknown)
        {
            return true;
        }

        if (value && value.toScalar instanceof Function)
        {
            return this.isunknown(value.toScalar());
        }

        return false;
    }

    isdenied(value)
    {
        if (value instanceof MychScriptContext.Denied)
        {
            return true;
        }

        if (value && value.toScalar instanceof Function)
        {
            return this.isdenied(value.toScalar());
        }

        return false;
    }

    getreason(value)
    {
        if (value instanceof MychScriptContext.DiagnosticUndef)
        {
            return value.reason;
        }

        if (value && value.toScalar instanceof Function)
        {
            return this.getreason(value.toScalar());
        }
        
        return new MychScriptContext.Unknown("Only <strong>denied</strong> and <strong>unknown</strong> values can have a reason");
    }

    floor(value)
    {
        return Math.floor(MychExpression.coerceNumber(value));
    }

    round(value)
    {
        return Math.round(MychExpression.coerceNumber(value));
    }

    ceil(value)
    {
        return Math.ceil(MychExpression.coerceNumber(value));
    }

    abs(value)
    {
        return Math.abs(MychExpression.coerceNumber(value));
    }

    len(value)
    {
        return MychExpression.coerceString(value).length;
    }

    min(varargs)
    {
        let minValue = undefined;

        for (let argIndex = 0; argIndex < arguments.length; ++argIndex)
        {
            let argValue = arguments[argIndex];
            
            if (argValue == undefined)
            {
                continue;
            }

            argValue = MychExpression.coerceNumber(argValue);

            if (minValue == undefined || minValue > argValue)
            {
                minValue = argValue;
            }
        }

        return minValue;
    }

    max(varargs)
    {
        let maxValue = undefined;

        for (let argIndex = 0; argIndex < arguments.length; ++argIndex)
        {
            let argValue = arguments[argIndex];
            
            if (argValue == undefined)
            {
                continue;
            }

            argValue = MychExpression.coerceNumber(argValue);
            
            if (maxValue == undefined || maxValue < argValue)
            {
                maxValue = argValue;
            }
        }

        return maxValue;
    }

    sin(degrees)
    {
        return Math.sin((Math.PI / 180) * MychExpression.coerceNumber(degrees));
    }

    cos(degrees)
    {
        return Math.cos((Math.PI / 180) * MychExpression.coerceNumber(degrees));
    }

    tan(degrees)
    {
        return Math.tan((Math.PI / 180) * MychExpression.coerceNumber(degrees));
    }

    asin(x)
    {
        return (180 / Math.PI) * Math.asin(MychExpression.coerceNumber(x));
    }

    acos(x)
    {
        return (180 / Math.PI) * Math.acos(MychExpression.coerceNumber(x));
    }

    atan(y, x = undefined)
    {
        return (180 / Math.PI) * (x == undefined
            ? Math.atan(MychExpression.coerceNumber(x))
            : Math.atan2(MychExpression.coerceNumber(y), MychExpression.coerceNumber(x)));
    }

    $decorateRoll(roll)
    {
        let context = this;

        let decoratedRoll = Object.create(roll);
            
        decoratedRoll.toScalar = function()
        {
            return this.results.total;
        };

        decoratedRoll.toMarkup = function()
        {
            return context.highlight(this, undefined, this.expression ? ("Rolling " + this.expression) : undefined).toMarkup();
        };

        return decoratedRoll;
    }

    $consumeRolls(rolls)
    {
        let rollIndex = 0;

        for (; rollIndex < rolls.length; ++rollIndex)
        {
            let rollReference = "$[[" + rollIndex + "]]";
            this[rollReference] = this.$decorateRoll(rolls[rollIndex]);
        }

        for (;; ++rollIndex)
        {
            let rollReference = "$[[" + rollIndex + "]]";
            if (this[rollReference] == undefined)
            {
                break;
            }
            delete this[rollReference];
        }
    }

    $cloneRolls(context)
    {
        let rollIndex = 0;

        for (;; ++rollIndex)
        {
            let rollReference = "$[[" + rollIndex + "]]";
            if (context[rollReference] == undefined)
            {
                break;
            }
            this[rollReference] = context[rollReference];
        }

        for (;; ++rollIndex)
        {
            let rollReference = "$[[" + rollIndex + "]]";
            if (this[rollReference] == undefined)
            {
                break;
            }
            delete this[rollReference];
        }
    }

    *roll(nameOrId_or_rollExpression, rollExpression_if_nameOrId = undefined)
    {
        let nameOrId;
        let rollExpression;
        
        if (arguments.length == 1)
        {
            nameOrId = this.sender;
            rollExpression = MychExpression.coerceString(nameOrId_or_rollExpression);
        }
        else
        {
            nameOrId = MychExpression.coerceString(nameOrId_or_rollExpression);
            rollExpression = MychExpression.coerceString(rollExpression_if_nameOrId);
        }

        if (rollExpression.match(/^\s*$/u))
        {
            return new MychScriptContext.Unknown("Roll expression empty");
        }

        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        let characterContext = (character ? character.get("name") : this.sender);

        rollExpression = rollExpression.replace(/@\{([^}]+)\}/ug, function(attributeCall, attributeExpression)
        {
            let attrExpressionParts = attributeExpression.split("|");
            let hasCharacterContext = (attrExpressionParts.length >= 3 || (attrExpressionParts.length == 2 && attrExpressionParts[1] == "max"));
            return hasCharacterContext ? attributeCall : "@{" + characterContext + "|" + attributeExpression + "}";
        });

        let context = this;

        let rollResult = yield MychScript.continueExecuteOnCallback(function(rollResultCallback)
        {
            function sendChatCallback(msgs)
            {
                let rollResultsMsg = msgs.filter(msg => msg.type == "rollresult")[0];
                
                if (!rollResultsMsg)
                {
                    console.log("No roll result found in sendChat() results:", msgs);
                    return;
                }

                let rollResults = JSON.parse(rollResultsMsg.content);
                rollResultCallback(context.$decorateRoll({ results: rollResults, expression: rollResultsMsg.origRoll }));
            }

            sendChat(context.sender || "Mych's Macro Magic (background roll)", "/roll " + MychExpression.coerceString(rollExpression), sendChatCallback, {use3d: true});
        });

        return rollResult;
    }

    iscritical(roll)
    {
        try
        {
            return roll.results.rolls.some(die => die.sides && die.results && die.results.some(dieroll => dieroll.v == die.sides));
        }
        catch (exception)
        {
            return new MychScriptContext.Unknown("Roll result required");
        }
    }

    isfumble(roll)
    {
        try
        {
            return roll.results.rolls.some(die => die.sides && die.results && die.results.some(dieroll => dieroll.v == 1));
        }
        catch
        {
            return new MychScriptContext.Unknown("Roll result required");
        }
    }

    literal(value)
    {
        return MychExpression.coerceString(value).replace(/[^\w\s]/ug, char => "&#" + char.codePointAt(0) + ";")
    }

    highlight(value, type = undefined, tooltip = undefined)
    {
        let result;
        
        if (value instanceof Object)
        {
            result = Object.create(value);
        }
        else
        {
            result = 
            {
                toScalar: function()
                {
                    return MychExpression.coerceScalar(value);
                },
            };
        }

        let styles =
        {
            "padding": "0 3px 0 3px",
            "color": "black",
            "background-color": "#FEF68E",
            "border": "2px solid #FEF68E",
            "font-weight": "bold",
            "font-size": "1.1em",
        };

        let styleOverrides =
        {
            "good":      { "border": "2px solid #3FB315" },
            "bad":       { "border": "2px solid #B31515" },
            "important": { "border": "2px solid #4A57ED" },
            "info":      { "border": "2px solid #E0E0E0", "background-color": "#E0E0E0" }
        };

        type = MychExpression.coerceString(type);

        if (type == "")
        {
            let isRollCritical = MychExpression.coerceBoolean(this.iscritical(value));
            let isRollFumbled = MychExpression.coerceBoolean(this.isfumble(value));

            type = (isRollCritical && isRollFumbled) ? "important" : isRollCritical ? "good" : isRollFumbled ? "bad" : "normal";
        }

        styles = { ...styles, ...styleOverrides[type] };

        if (tooltip)
        {
            styles["cursor"] = "help";
        }

        let valueLiteral = this.literal(value);
        let styleLiteral = this.literal(Object.entries(styles).map(styleEntry => styleEntry.join(":")).join(";"));

        if (!tooltip)
        {
            let classLiteral = this.literal("mmm-highlight mmm-highlight-" + type);

            result.toMarkup = function()
            {
                return "<span class=\"" + classLiteral + "\" style=\"" + styleLiteral + "\">" + valueLiteral + "</span>";
            }
        }
        else
        {
            let titleLiteral = this.literal(tooltip);
            let classLiteral = this.literal("mmm-highlight mmm-highlight-" + type + " showtip tipsy-n-right");

            result.toMarkup = function()
            {
                return "<span class=\"" + classLiteral + "\" title=\"" + titleLiteral + "\" style=\"" + styleLiteral + "\">" + valueLiteral + "</span>";
            };
        }

        return result;
    }

    $getChatSender(nameOrId = undefined)
    {
        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId || this.sender);

        let characterName;
        let tokenName;

        if (character && this.$canControlAttribute(character, "name"))
        {
            characterName = character.get("name");
        }

        if (token && this.$canControlAttribute(token, "name"))
        {
            tokenName = token.get("name");
        }

        if (tokenName && tokenName != characterName)
        {
            return tokenName;
        }

        if (characterName)
        {
            return "character|" + character.id;
        }

        if (this.playerid)
        {
            return "player|" + this.playerid;
        }

        if (this.sender)
        {
            return this.sender;
        }

        return "Mych's Macro Magic";
    }

    static $sendChatWithImpersonation(sender, message, impersonation)
    {
        let prevImpersonation;

        function startImpersonation()
        {
            prevImpersonation = MychScriptContext.impersonation;
            MychScriptContext.impersonation = impersonation;
        }

        function stopImpersonation()
        {
            MychScriptContext.impersonation = prevImpersonation;
        }

        sendChat(sender, "/direct MMM starts impersonation of " + impersonation.playerid, startImpersonation)
        sendChat(sender, message);
        sendChat(sender, "/direct MMM stops impersonation of " + impersonation.playerid, stopImpersonation)
    }

    chat(nameOrId_or_message, message_if_nameOrId = undefined)
    {
        let nameOrId;
        let message;

        if (arguments.length == 1)
        {
            nameOrId = undefined;
            message = nameOrId_or_message;
        }
        else
        {
            nameOrId = MychExpression.coerceString(nameOrId_or_message);
            message = message_if_nameOrId;
        }
        
        let sender = this.$getChatSender(nameOrId);
        let messageString = MychExpression.coerceString(message);

        if (messageString.startsWith("!"))
        {
            let impersonation =
            {
                playerid: this.playerid,
                selected: this.selected,
            };

            MychScriptContext.$sendChatWithImpersonation(sender, messageString, impersonation);
        }
        else
        {
            let messageMarkup = MychExpression.coerceMarkup(message);

            sendChat(sender, messageMarkup);
        }
    }

    whisperback(message)
    {
        let playerObj = getObj("player", this.playerid);

        if (!playerObj)
        {
            log("!mmm do whisperback() for player " + this.playerid + ": " + message);
        }
        else
        {
            let recipient = playerObj.get("displayname");

            // remove all tokens from first double-quote on (since we can't escape double-quotes)
            recipient = recipient.replace(/\s*".*/u, "");

            // enclose in double quotes, but only if there are actually spaces
            if (recipient.match(/\s/u))
            {
                recipient = "\"" + recipient + "\"";
            }

            let messageMarkup = MychExpression.coerceMarkup(message);

            sendChat("Mych's Macro Magic", "/w " + recipient + " <br/>" + messageMarkup, null, { noarchive: true });
        }
    }

    *delay(seconds)
    {
        let milliseconds = Math.round(MychExpression.coerceNumber(seconds) * 1000);

        yield MychScript.continueExecuteOnCallback(function(continueCallback)
        {
            setTimeout(continueCallback, milliseconds);
        });
    }

    error(exception)
    {
        log("MMM [" + MMM_STARTUP_INSTANCE + "] " + (exception.stack || exception));
        this.whisperback(this.literal(exception));
    }

    getprop(nameOrId, attributeName)
    {
        let attributeValue = this.getattr(nameOrId, attributeName);

        let attributeStruct =
        {
            toScalar: () => attributeValue,
            $getProperty: key => (key == "max") ? this.getattrmax(nameOrId, attributeName) : this.getprop(attributeValue, key),
        };

        return attributeStruct;
    }

    distunits()
    {
        let playerPageId = Campaign().get("playerpageid");
        let playerPage = getObj("page", playerPageId)

        if (!playerPage)
        {
            return MychScriptContext.Unknown("Player page currently unset")
        }

        return playerPage.get("scale_units");
    }

    distscale()
    {
        let playerPageId = Campaign().get("playerpageid");
        let playerPage = getObj("page", playerPageId)

        if (!playerPage)
        {
            return MychScriptContext.Unknown("Player page currently unset")
        }

        let gridUnitsPerGridCell = playerPage.get("snapping_increment");
        let pixelsPerGridUnit = 70;
        let pixelsPerGridCell = pixelsPerGridUnit * (gridUnitsPerGridCell || 1);
        let measurementUnitsPerGridCell = playerPage.get("scale_number");
        let measurementUnitsPerPixel = measurementUnitsPerGridCell / pixelsPerGridCell;

        return measurementUnitsPerPixel;
    }

    distsnap()
    {
        let playerPageId = Campaign().get("playerpageid");
        let playerPage = getObj("page", playerPageId)

        if (!playerPage)
        {
            return MychScriptContext.Unknown("Player page currently unset")
        }

        let gridUnitsPerGridCell = playerPage.get("snapping_increment");
        let pixelsPerGridUnit = 70;
        let pixelsPerGridCell = pixelsPerGridUnit * gridUnitsPerGridCell;

        return pixelsPerGridCell;
    }

    spawnfx(type, x1, y1, x2, y2)
    {
        type = MychExpression.coerceString(type);

        x1 = MychExpression.coerceNumber(x1);
        y1 = MychExpression.coerceNumber(y1);

        if (x2 == undefined)
        {
            spawnFx(x1, y1, type);
        }
        else
        {
            x2 = MychExpression.coerceNumber(x2);
            y2 = MychExpression.coerceNumber(y2);
    
            spawnFxBetweenPoints({x: x1, y: y1}, {x: x2, y: y2}, type);
        }
    }

    getcharid(nameOrId)
    {
        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character)
        {
            return new MychScriptContext.Unknown("Character or token <strong>" + this.literal(nameOrId) + "</strong> not found")
        }

        return character.id;
    }

    findattr(nameOrId, table, selection)
    {
        if (nameOrId instanceof MychScriptContext.DiagnosticUndef)
        {
            return nameOrId;
        }

        nameOrId = MychExpression.coerceString(nameOrId);

        if (nameOrId == "")
        {
            return new MychScriptContext.Unknown("Character or token name or identifier not specified");
        }

        const firstSelectionArgIndex = 2;

        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character || !this.$canControl(character))
        {
            return new MychScriptContext.Denied("Character or token <strong>" + this.literal(nameOrId) + "</strong> inaccessible");
        }

        if (arguments.length == 1)
        {
            let tableNames = {};

            let attributeNameRegExp = /^repeating_(?<tableName>[^_]+)_/u;
            let attributes = findObjs({ type: "attribute", characterid: character.id });

            for (let attribute of attributes)
            {
                let attributeName = attribute.get("name");
                let attributeNameMatch = attributeNameRegExp.exec(attributeName);
    
                if (!attributeNameMatch || !this.$canViewAttribute(character, attributeName))
                {
                    continue;
                }

                let tableName = attributeNameMatch.groups.tableName;

                tableNames[tableName.toLowerCase()] = tableName;
            }

            return Object.values(tableNames);
        }

        let tableRegExpSource = MychExpression.createLiteralRegExpSource(MychExpression.coerceString(table));

        let attributeNameRegExpSource = /^repeating_/u.source + tableRegExpSource + /_(?<rowId>[-A-Za-z0-9]+)_(?<colName>\S+)$/u.source;
        let attributeNameRegExp = new RegExp(attributeNameRegExpSource, "ui");

        if (arguments.length == 2)
        {
            let colNames = {};

            let attributes = findObjs({ type: "attribute", characterid: character.id });

            for (let attribute of attributes)
            {
                let attributeName = attribute.get("name");
                let attributeNameMatch = attributeNameRegExp.exec(attributeName);
    
                if (!attributeNameMatch || !this.$canViewAttribute(character, attributeName))
                {
                    continue;
                }
                
                let colName = attributeNameMatch.groups.colName;

                colNames[colName.toLowerCase()] = colName;
            }

            return Object.values(colNames);
        }

        let conditions = {};
        let conditionCount = 0;

        for (let argIndex = firstSelectionArgIndex; argIndex < arguments.length - 1; argIndex += 2)
        {
            let colName = MychExpression.coerceString(arguments[argIndex]);
            let colValue = MychExpression.coerceString(arguments[argIndex + 1]);

            conditions[colName.toLowerCase()] = { normalizedValue: colValue.toLowerCase(), originalValue: colValue, originalName: colName };
            conditionCount += 1;
        }

        let rowInfos = {}

        let lookupColName = ((arguments.length - firstSelectionArgIndex) % 2 == 0
            ? arguments[arguments.length - 2]
            : arguments[arguments.length - 1]); 

        let attributes = findObjs({ type: "attribute", characterid: character.id });

        for (let attribute of attributes)
        {
            let attributeName = attribute.get("name");
            let attributeNameMatch = attributeNameRegExp.exec(attributeName);

            if (!attributeNameMatch || !this.$canViewAttribute(character, attributeName))
            {
                continue;
            }

            let rowId = attributeNameMatch.groups.rowId;
            let colName = attributeNameMatch.groups.colName;
            let colValue = MychExpression.coerceString(attribute.get("current"));

            rowInfos[rowId] = rowInfos[rowId] || { conditionCount: 0, lookupAttributeName: undefined };

            let condition = conditions[colName.toLowerCase()];

            if (condition && condition.normalizedValue == colValue.toLowerCase())
            {
                rowInfos[rowId].conditionCount += 1;
            }

            if (colName.toLowerCase() == lookupColName.toLowerCase())
            {
                rowInfos[rowId].lookupAttributeName = attributeName;
            }
        }

        let attributeNames = Object.values(rowInfos).filter(rowInfo => rowInfo.lookupAttributeName && rowInfo.conditionCount == conditionCount).map(rowInfo => rowInfo.lookupAttributeName);

        if (attributeNames.length > 0)
        {
            let result =
            {
                toScalar: () => attributeNames[0],
                toList:   () => attributeNames,
            };

            return result;
        }

        let nameOrIdDescription = "character <strong>" + this.literal(nameOrId) + "</strong>";
        let tableDescription = "character sheet table <strong>" + this.literal(table) + "</strong>";
        let lookupColDescription = "column <strong>" + this.literal(lookupColName) + "</strong>";
        let conditionsDescription = Object.values(conditions).map(condition => "<strong>" + this.literal(condition.originalName) + "</strong> is <strong>" + this.literal(condition.originalValue) + "</strong>").join(" and ");

        return new MychScriptContext.Unknown("No row with " + lookupColDescription + " found in " + tableDescription + " of " + nameOrIdDescription + " where " + conditionsDescription);
    }

    getattr(nameOrId, attributeName)
    {
        return this.$getAttribute(nameOrId, attributeName, false);
    }

    getattrmax(nameOrId, attributeName)
    {
        return this.$getAttribute(nameOrId, attributeName, true);
    }

    setattr(nameOrId, attributeName, attributeValue)
    {
        return this.$setAttribute(nameOrId, attributeName, attributeValue, false);
    }

    setattrmax(nameOrId, attributeName, attributeValue)
    {
        return this.$setAttribute(nameOrId, attributeName, attributeValue, true);
    }

    static $storePlayerIsPrivileged(playerId, playerIsPrivileged)
    {
        (undefined != globalThis.state) ||
            (globalThis.state = {});
        (undefined != globalThis.state.MychScriptContext) ||
            (globalThis.state.MychScriptContext = {});
        (undefined != globalThis.state.MychScriptContext.$isPrivileged) ||
            (globalThis.state.MychScriptContext.$isPrivileged = {});
        
        globalThis.state.MychScriptContext.$isPrivileged[playerId] = playerIsPrivileged;
    }

    static $fetchPlayerIsPrivileged(playerId)
    {
        let playerIsPrivileged =
            undefined != globalThis.state &&
            undefined != globalThis.state.MychScriptContext &&
            undefined != globalThis.state.MychScriptContext.$isPrivileged &&
            Boolean(globalThis.state.MychScriptContext.$isPrivileged[playerId]);
    
        return playerIsPrivileged;
    }

    static $refreshPlayerIsPrivileged(playerId = undefined)
    {
        if (playerId)
        {
            MychScriptContext.$isPrivileged(playerId);
        }
        else
        {
            for (let playerObj of findObjs({ type: "player" }))
            {
                MychScriptContext.$isPrivileged(playerObj.id);
            }
        }
    }

    static $isPrivileged(playerId)
    {
        let playerIsPrivileged = playerIsGM(playerId);
        
        if (playerIsPrivileged)
        {
            // positive response is always reliable (player must be online)
            MychScriptContext.$storePlayerIsPrivileged(playerId, true);
        }
        else
        {
            let playerObj = getObj("player", playerId);
            let playerIsOnline = playerObj && playerObj.get("online");

            if (playerIsOnline)
            {
                // negative response is only reliable when player is online
                MychScriptContext.$storePlayerIsPrivileged(playerId, false);
            }
            else
            {
                // override negative response with cached response if player is offline
                playerIsPrivileged = MychScriptContext.$fetchPlayerIsPrivileged(playerId);
            }
        }

        return playerIsPrivileged;
    }

    $canControl(obj)
    {
        if (!this.playerid || !obj || !obj.get)
        {
            return false;
        }

        if (MychScriptContext.$isPrivileged(this.playerid))
        {
            return true;
        }

        let objType = obj.get("type");

        if (objType == "attribute")
        {
            let ownerCharacterId = obj.get("characterid");
            let ownerCharacter = getObj("character", ownerCharacterId);
            return this.$canControl(ownerCharacter);
        }

        if (objType == "hand" && obj.get("parentid") == this.playerid)
        {
            return true;
        }

        // objType == "graphic"
        let representsCharacterId = obj.get("represents");

        if (representsCharacterId)
        {
            let representsCharacter = getObj("character", representsCharacterId);
            return this.$canControl(representsCharacter);
        }

        // objType == "path", "text", "graphic", "character"
        let controllerPlayerIds = obj.get("controlledby");

        if (controllerPlayerIds && controllerPlayerIds.split(",").some(id => id == "all" || id == this.playerid))
        {
            return true;
        }

        return false;
    }

    $canControlAttribute(obj, attributeName)
    {
        return this.$canControl(obj);
    }

    $canView(obj)
    {
        if (!this.playerid || !obj || !obj.get)
        {
            return false;
        }

        if (this.$canControl(obj))
        {
            return true;
        }

        let objType = obj.get("type");

        if (objType == "attribute")
        {
            let characterId = obj.get("characterid");
            return this.$canView(getObj("character", characterId));
        }

        let playerPageId = Campaign().get("playerpageid");

        if (objType == "page" && obj.id == playerPageId)
        {
            return true;
        }

        // objType == "character", "handout"
        let journalPlayerIds = obj.get("inplayerjournals");

        if (journalPlayerIds && journalPlayerIds.split(",").some(id => id == "all" || id == this.playerid))
        {
            return true;
        }

        // objType == "text", "path", "graphic"
        let drawingPageId = obj.get("pageid");

        if (drawingPageId && drawingPageId == playerPageId)
        {
            let drawingLayer = obj.get("layer");
            return (drawingLayer == "objects" || drawingLayer == "maps");
        }

        return false;
    }

    $canViewAttribute(obj, attributeName)
    {
        if (attributeName == "permission")
        {
            return true;
        }

        if (this.$canControlAttribute(obj, attributeName))
        {
            return true;
        }

        switch (attributeName)
        {
            case "id":
            case "character_id":
            case "token_id":
            {
                return this.$canView(obj);
            }

            case "name":
            case "character_name":
            case "token_name":
            {
                let character = this.$getCorrespondingCharacterObj(obj);
                let token = this.$getCorrespondingTokenObj(obj);
                return (this.$canView(character) || (this.$canView(token) && token.get("showplayers_name")));
            }

            case "bar1":
            case "bar2":
            case "bar3":
            {
                let token = this.$getCorrespondingTokenObj(obj);
                return (this.$canView(token) && token.get("showplayers_" + attributeName));
            }

            case "left":
            case "top":
            case "width":
            case "height":
            case "rotation":
            {
                return this.$canView(obj);
            }
        }

        let statusAttributeNameRegExp = /^status_(?<identifier>\w+)$/u;
        let statusAttributeNameMatch = statusAttributeNameRegExp.exec(attributeName);

        if (statusAttributeNameMatch)
        {
            return this.$canView(obj);
        }

        return false;
    }

    $getCorrespondingTokenObj(characterOrToken)
    {
        if (!characterOrToken || !characterOrToken.get)
        {
            return undefined;
        }

        switch (characterOrToken.get("type"))
        {
            case "graphic":
            {
                return characterOrToken;
            }

            case "character":
            {
                let playerPageId = Campaign().get("playerpageid");
                let tokens = findObjs({ type: "graphic", subtype: "token", represents: characterOrToken.id, pageid: playerPageId, layer: "objects" });
                return (tokens ? tokens[0] : undefined);
            }
        }

        return undefined;
    }    

    $getCorrespondingCharacterObj(characterOrToken)
    {
        if (!characterOrToken || !characterOrToken.get)
        {
            return undefined;
        }

        switch (characterOrToken.get("type"))
        {
            case "character":
            {
                return characterOrToken;
            }

            case "graphic":
            {
                let character = getObj("character", characterOrToken.get("represents"));
                return character;
            }
        }

        return undefined;
    }    

    $getCharacterAndTokenObjs(nameOrId)
    {
        let characterOrToken =
            getObj("character", nameOrId) ||
            getObj("graphic", nameOrId);

        if (!this.$canView(characterOrToken))
        {
            characterOrToken = undefined;
        }

        if (!characterOrToken)
        {
            characterOrToken =
                findObjs({ type: "character", name: nameOrId }, { caseInsensitive: true }).filter(obj => this.$canViewAttribute(obj, "name"))[0] ||
                findObjs({ type: "graphic", name: nameOrId }, { caseInsensitive: true }).filter(obj => this.$canViewAttribute(obj, "name"))[0];
        }

        if (!characterOrToken)
        {
            return [undefined, undefined];
        }

        let character = undefined;
        let token = undefined;

        switch (characterOrToken.get("type"))
        {
            case "character":
            {
                character = characterOrToken;
                token = this.$getCorrespondingTokenObj(characterOrToken);
            }
            break;

            case "graphic":
            {
                character = this.$getCorrespondingCharacterObj(characterOrToken);
                token = characterOrToken;
            }
            break;
        }

        return [character, token];
    }

    $getAttribute(nameOrId, attributeName, max = false)
    {
        if (nameOrId instanceof MychScriptContext.DiagnosticUndef)
        {
            return nameOrId;
        }

        if (attributeName instanceof MychScriptContext.DiagnosticUndef)
        {
            return attributeName;
        }

        nameOrId = MychExpression.coerceString(nameOrId);

        if (nameOrId == "")
        {
            return new MychScriptContext.Unknown("Charakter or token name or identifier not specified");
        }

        attributeName = MychExpression.coerceString(attributeName);

        if (attributeName == "")
        {
            return new MychScriptContext.Unknown("Attribute name not specified");
        }

        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character && !token)
        {
            if (attributeName == "permission")
            {
                return "none";
            }

            return new MychScriptContext.Denied("Character or token <strong>" + this.literal(nameOrId) + "</strong> inaccessible");
        }

        let lookupObj = undefined;
        let lookupKey = undefined;
        let lookupMod = val => val;

        switch (attributeName)
        {
            case "permission":
            {
                return (this.$canControl(token || character) ? "control" : "view");
            }

            case "name":
            {
                lookupObj = token || character;
                lookupKey = (max ? undefined : "name");
            }
            break;

            case "character_name":
            {
                lookupObj = character;
                lookupKey = (max ? undefined : "name");
            }
            break;
            
            case "token_name":
            {
                lookupObj = token;
                lookupKey = (max ? undefined : "name");
            }
            break;

            case "character_id":
            {
                lookupObj = character;
                lookupKey = (max ? undefined : "id");
            }
            break;

            case "token_id":
            {
                lookupObj = token;
                lookupKey = (max ? undefined : "id");
            }
            break;
        
            case "bar1":
            case "bar2":
            case "bar3":
            {
                lookupObj = token;
                lookupKey = attributeName + (max ? "_max" : "_value");
            }
            break;

            case "left":
            case "top":
            {
                if (max)
                {
                    lookupObj = getObj("page", Campaign().get("playerpageid"));
                    lookupKey = (attributeName == "left" ? "width" : "height");
                    lookupMod = val => 70 * val;
                }
                else
                {
                    lookupObj = token;
                    lookupKey = attributeName;
                }
            }
            break;

            case "width":
            case "height":
            case "rotation":
            {
                if (!max)
                {
                    lookupObj = token;
                    lookupKey = attributeName;
                }
            }
            break;

            default:
            {
                let statusAttributeNameRegExp = /^status_(?<identifier>\w+)$/u;
                let statusAttributeNameMatch = statusAttributeNameRegExp.exec(attributeName);
        
                if (statusAttributeNameMatch)
                {
                    if (!max)
                    {
                        let statusIdentifier = statusAttributeNameMatch.groups.identifier;

                        lookupObj = token;
                        lookupKey = "status_" + statusIdentifier.replace(/_/ug, "-");
                        
                        // modify value to make both boolean and numeric interpretation simple:
                        // - false (hidden): false (as number: 0)
                        // - digit (shown with digit): string digit (as bool: true, number: digit)
                        // - other (shown undecorated): string "shown" (as bool: true, number: 0)
                        lookupMod = val => (val === false ? false : (str => str.match(/^[0-9]$/u) ? str : "shown")(MychExpression.coerceString(val)));
                    }
                    break;
                }

                if (character)
                {
                    lookupObj = findObjs({ type: "attribute", characterid: character.id, name: attributeName }, { caseInsensitive: true })[0];
                    lookupKey = (max ? "max" : "current");
                }
            }
            break;
        }
        
        if (!lookupObj)
        {
            return new MychScriptContext.Unknown("Attribute <strong>" + this.literal(attributeName) + "</strong> does not exist");
        }

        if (!lookupKey)
        {
            let currentOrMaxDescription = (max ? "Maximum" : "Current");
            return new MychScriptContext.Unknown(currentOrMaxDescription + " value of attribute <strong>" + this.literal(attributeName) + "</strong> does not exist");
        }

        if (!this.$canViewAttribute(lookupObj, attributeName))
        {
            return new MychScriptContext.Denied("Attribute <strong>" + this.literal(attributeName) + "</strong> of character or token <strong>" + this.literal(nameOrId) + "</strong> inaccessible");
        }

        return lookupMod(lookupObj.get(lookupKey));
    }

    $setAttribute(nameOrId, attributeName, attributeValue, max = false)
    {
        if (nameOrId instanceof MychScriptContext.DiagnosticUndef)
        {
            return nameOrId;
        }

        if (attributeName instanceof MychScriptContext.DiagnosticUndef)
        {
            return attributeName;
        }

        nameOrId = MychExpression.coerceString(nameOrId);

        if (nameOrId == "")
        {
            return new MychScriptContext.Unknown("Charakter or token name or identifier not specified");
        }

        attributeName = MychExpression.coerceString(attributeName);

        if (attributeName == "")
        {
            return new MychScriptContext.Unknown("Attribute name not specified");
        }

        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character && !token)
        {
            return new MychScriptContext.Denied("Character or token <strong>" + this.literal(nameOrId) + "</strong> inaccessible");
        }

        let updateObj = undefined;
        let updateKey = undefined;
        let updateVal = undefined;

        switch (attributeName)
        {
            case "permission":
            {
                return new MychScriptContext.Denied("Attribute <strong>" + this.literal(attributeName) + "</strong> of character or token <strong>" + this.literal(nameOrId) + "</strong> cannot be modified");
            }

            case "name":
            {
                updateObj = character || token;
            }
            break;
                
            case "character_name":
            {
                updateObj = character;
            }
            break;
            
            case "token_name":
            {
                updateObj = token;
            }
            break;

            case "character_id":
            {
                updateObj = character;
            }
            break;

            case "token_id":
            {
                updateObj = token;
            }
            break;
        
            case "bar1":
            case "bar2":
            case "bar3":
            {
                updateObj = token;
                updateKey = attributeName + (max ? "_max" : "_value");
                updateVal = MychExpression.coerceNumber(attributeValue);
            }
            break;

            case "left":
            case "top":
            {
                if (max)
                {
                    // changing page dimensions through token intentionally unsupported
                }
                else
                {
                    updateObj = token;
                    updateKey = attributeName;
                    updateVal = MychExpression.coerceNumber(attributeValue);
                }
            }
            break;

            case "width":
            case "height":
            case "rotation":
            {
                if (!max)
                {
                    updateObj = token;
                    updateKey = attributeName;
                    updateVal = MychExpression.coerceNumber(attributeValue);
                }
            }
            break;

            default:
            {
                let statusAttributeNameRegExp = /^status_(?<identifier>\w+)$/u;
                let statusAttributeNameMatch = statusAttributeNameRegExp.exec(attributeName);
        
                if (statusAttributeNameMatch)
                {
                    if (!max)
                    {
                        let statusIdentifier = statusAttributeNameMatch.groups.identifier;
                        
                        updateObj = token;
                        updateKey = "status_" + statusIdentifier.replace(/_/ug, "-");

                        if (statusIdentifier == "dead")
                        {
                            // dead marker (big red cross) crashes client when given an overlay
                            updateVal = MychExpression.coerceString(attributeValue);
                            updateVal = (updateVal == "false" || updateVal == "" ? false : true);
                        }
                        else
                        {
                            // revert conversion done when reading status marker state
                            updateVal = MychExpression.coerceString(attributeValue);
                            updateVal = (updateVal == "false" || updateVal == "" ? false : updateVal.match(/^[0-9]$/u) ? updateVal : true);
                        }
                    }
                    break;
                }

                if (character)
                {
                    if (!this.$canControlAttribute(character, attributeName))
                    {
                        updateObj = character;
                    }
                    else
                    {
                        updateObj =
                            findObjs({ type: "attribute", characterid: character.id, name: attributeName }, { caseInsensitive: true })[0] ||
                            createObj("attribute", { characterid: character.id, name: attributeName });

                        updateKey = (max ? "max" : "current");
                        updateVal = MychExpression.coerceScalar(attributeValue);
                    }
                }
            }
            break;
        }
        
        if (!updateObj)
        {
            return new MychScriptContext.Unknown("Attribute <strong>" + this.literal(attributeName) + "</strong> does not exist and cannot be created");
        }

        if (!updateKey)
        {
            let currentOrMaxDescription = (max ? "Maximum" : "Current");
            return new MychScriptContext.Unknown(currentOrMaxDescription + " value of attribute <strong>" + this.literal(attributeName) + "</strong> does not exist and cannot be created");
        }
        
        if (!this.$canControlAttribute(updateObj, attributeName))
        {
            return new MychScriptContext.Denied("Attribute <strong>" + this.literal(attributeName) + "</strong> of character or token <strong>" + this.literal(nameOrId) + "</strong> cannot be modified");
        }

        updateObj.set(updateKey, updateVal);

        return this.$getAttribute(nameOrId, attributeName, max);
    }

    $debugHighlight(value)
    {
        let literalValue = this.literal(value);

        let highlightStart = "<span style='background: #E0E0E0; padding: 0em 0.3em; border: 2px solid silver; border-radius: 0.5em; color: black; white-space: pre-wrap'>";
        let highlightStop = "</span>";

        let highlight =
        {
            toScalar: () => literalValue,
            toMarkup: () => highlightStart + literalValue + highlightStop,
        };

        return highlight;
    }

    $debugExpression(value)
    {
        if (value && value.toMarkup instanceof Function)
        {
            return value;
        }

        return this.$debugHighlight(MychExpression.literal(value));
    }

    $debugSendExpression(result, source, resultSourceBegin = 0, resultSourceEnd = source.length)
    {
        let markedSourceBefore = source.substring(0, resultSourceBegin);
        let markedSourceBetween = source.substring(resultSourceBegin, resultSourceEnd);
        let markedSourceAfter = source.substring(resultSourceEnd);

        let debugResult = MychExpression.coerceMarkup(this.$debugExpression(result));
        let debugSource = this.literal(markedSourceBefore) + MychExpression.coerceMarkup(this.$debugHighlight(markedSourceBetween)) + this.literal(markedSourceAfter);
        
        this.$debugSendMessage(debugResult + " \u25C0\uFE0F " + debugSource);
    }

    $debugSendMessage(message)
    {
        this.whisperback("\u{1F50E} " + MychExpression.coerceMarkup(message));
    }

    $statusReset()
    {
        MychScriptContext.players = {};
        this.whisperback("All state reset.")
    }

    $statusDump()
    {
        let statusTableRows = [];

        let staticContextVariableTests =
        {
            version:  v => v == MMM_VERSION,
            pi:       v => v == Math.PI,
            default:  v => this.isdefault(v),
            denied:   v => this.isdenied(v),
            unknown:  v => this.isunknown(v),
        };

        for (let [playerId, player] of Object.entries(MychScriptContext.players))
        {
            let playerObj = getObj("player", playerId);
            let playerDescription;

            if (playerObj)
            {
                let playerName = playerObj.get("displayname");
                let playerOnline = playerObj.get("online");
                
                playerDescription = playerName + " (" + (playerOnline ? "online" : "offline") + ")";

                if (MychScriptContext.$isPrivileged(playerId))
                {
                    playerDescription += " (privileged)";
                }
            }

            statusTableRows.push([ this.literal(playerDescription || playerId) ]);
            statusTableRows.push([ "Seen", player.lastseen.toISOString().replace(/T/u, " ").replace(/Z$/u, " UTC") ]);

            let contextDescription = "";

            for (let [contextVariableName, contextVariableValue] of Object.entries(player.context))
            {
                if (contextVariableName.startsWith("$"))
                {
                    continue;
                }

                if (staticContextVariableTests.hasOwnProperty(contextVariableName) &&
                    staticContextVariableTests[contextVariableName](contextVariableValue))
                {
                    continue;
                }

                let contextVariableMarkup = (contextVariableValue && contextVariableValue.toMarkup ? contextVariableValue.toMarkup() : this.literal(JSON.stringify(contextVariableValue)));
                contextDescription += this.literal(contextVariableName) + " = " + contextVariableMarkup + "<br/>";
            }

            statusTableRows.push([ "Context", (contextDescription || "empty" )]);

            let scriptDescriptions = [];

            if (player.customizations)
            {
                for (let customizeScript of player.customizations.nestedScripts)
                {
                    scriptDescriptions.push(customizeScript.type || "uninitialized");
                }
            }

            if (player.script)
            {
                function generateScriptSummary(script)
                {
                    if (script.complete)
                    {
                        return script.type || "uninitialized";
                    }
    
                    let nestedScriptSummaries = script.nestedScripts.map(nestedScript => generateScriptSummary(nestedScript)).concat("...");
                    return script.type + " [" + nestedScriptSummaries.join(", ") + "]";
                }
    
                scriptDescriptions.push(generateScriptSummary(player.script));
            }

            statusTableRows.push([ "Script", this.literal(scriptDescriptions.join(", ") || "no script") ]);
            statusTableRows.push([ "Error", this.literal(player.exception || "no exception") ]);
        }

        function renderTableBodyRow(row)
        {
            let tableColumnStart = (row.length == 1 ? "<td colspan='2' style='text-align: center'>" : "<td>");
            return "<tr>" + row.map(content => tableColumnStart + content + "</td>").join("") + "</tr>";
        }

        let statusTableCaption = "<caption>Mych's Macro Magic " + MMM_VERSION + "</caption>";
        let statusTableBody = "<tbody>" + statusTableRows.map(renderTableBodyRow).join("") + "</tbody>";

        let statusOutput = "<div class='sheet-rolltemplate-default'><table>" + statusTableCaption + statusTableBody + "</table></div>";
        
        this.whisperback(statusOutput);
    }

    $exportScript(destination, source, backup = true)
    {
        let sourceLines = source.split("\n").filter(line => !line.match(/^\s*$/u)).map(line => "!mmm " + line);
        
        this.whisperback("<span style='white-space: pre'>" + sourceLines.map(line => this.literal(line)).join("<br/>") + "</span>");

        if (destination == "chat")
        {
            return;
        }

        let messageLines = [];

        let destinationMacro = findObjs({ type: "macro", playerid: this.playerid, name: destination }, { caseInsensitive: true })[0];
        
        if (destinationMacro)
        {
            let destinationMacroSource = destinationMacro.get("action");
            let destinationMacroSourceLines = destinationMacroSource.split("\n").filter(line => !line.match(/^\s*$/u));
    
            let destinationMacroSourcePrefixLines = [];
            let destinationMacroSourceSuffixLines = [];
            let destinationMacroSourceLinesAreScript = destinationMacroSourceLines.map(line => !!line.match(/^!mmm(?![\p{L}\p{N}_])/u));
            let destinationMacroSourceFirstScriptLineIndex = destinationMacroSourceLinesAreScript.indexOf(true);

            if (destinationMacroSourceFirstScriptLineIndex < 0)
            {
                destinationMacroSourcePrefixLines = destinationMacroSourceLines;
            }
            else
            {
                destinationMacroSourcePrefixLines = destinationMacroSourceLines.slice(0, destinationMacroSourceFirstScriptLineIndex);
                destinationMacroSourceSuffixLines = destinationMacroSourceLines.slice(destinationMacroSourceLinesAreScript.lastIndexOf(true) + 1);
            }

            if (backup)
            {
                let existingMacroNames = findObjs({ type: "macro", playerid: this.playerid }).map(macro => macro.get("name"));

                let backupMacroSuffixRegExpSource = /^/u.source + MychExpression.createLiteralRegExpSource(destination) + /_backup_(?<suffix>\d+)$/u.source;
                let backupMacroSuffixRegExp = new RegExp(backupMacroSuffixRegExpSource, "ui");
                
                let existingBackupMacroMaxSuffix = Math.max(0, ...existingMacroNames.map(name => backupMacroSuffixRegExp.exec(name)).filter(match => match).map(match => parseInt(match.groups.suffix)));

                let backupMacroSuffix = existingBackupMacroMaxSuffix + 1;
                let backupMacroName = destinationMacro.get("name") + "_backup_" + backupMacroSuffix;

                createObj("macro", { playerid: this.playerid, name: backupMacroName, action: destinationMacroSource });

                messageLines.push("Previous version saved as <strong>..._backup_" + this.literal(backupMacroSuffix) + "</strong>");
            }

            destinationMacroSource = [...destinationMacroSourcePrefixLines, ...sourceLines, ...destinationMacroSourceSuffixLines].join("\n");
            destinationMacro.set({ action: destinationMacroSource });

            messageLines.unshift("Updated macro <strong>" + this.literal(destinationMacro.get("name")) + "</strong>");
        }
        else
        {
            let destinationMacroSource = sourceLines.join("\n");
            destinationMacro = createObj("macro", { playerid: this.playerid, name: destination, action: destinationMacroSource });

            messageLines.push("Created macro <strong>" + this.literal(destinationMacro.get("name")) + "</strong>");
        }

        this.whisperback(messageLines.join("<br/>"));
    }
}

class MychScriptVariables extends MychProperties
{
    constructor(parent = undefined)
    {
        super(parent);
        this.$customizations = (parent && parent.$customizations) ? parent.$customizations : {};
    }

    $getAnonymousVariable()
    {
        return this["..."];
    }

    $withAnonymousVariable(anonymousValue)
    {
        let nestedVariables = new MychScriptVariables(this);
        nestedVariables["..."] = anonymousValue;

        return nestedVariables;
    }

    $integrateCustomizations(customizations)
    {
        for (let [key, value] of Object.entries(customizations))
        {
            if (key.match(/^\w+$/u) || !(value instanceof Object))
            {
                this.$customizations[key] = value;
            }
            else
            {
                this.$customizations[key] || (this.$customizations[key] = {});
                Object.assign(this.$customizations[key], value);
            }
        }
    }
}

class MychScriptError
{
    static prefix = "!mmm ";

    constructor(stage, message, source, offset, cause = undefined)
    {
        this.stage = stage;
        this.message = message;
        this.source = MychScriptError.prefix + source;
        this.offset = MychScriptError.prefix.length + offset;
        this.cause = cause;
    }

    toString()
    {
        let errorSourceLocation =
            this.source.substring(0, this.offset) + "\u274C" +
            this.source.substring(this.offset);

        if (this.cause instanceof MychScriptError)
        {
            return this.cause + "\n" + "Called from: " + errorSourceLocation;
        }

        return "During " + this.stage + ", " + this.message + " in script: " + errorSourceLocation;
    }
}

class MychScriptExit
{
    constructor(type, result = undefined)
    {
        this.type = type;
        this.result = result;
    }
}

class MychScript
{
    constructor()
    {
        this.type = undefined;
        this.source = undefined;
        this.context = undefined;
        this.definition = {};
        this.nestedScripts = [];
        this.complete = false;
    }

    rethrowExpressionError(stage, exception, expressionOffset, source)
    {
        if (exception instanceof MychExpressionError)
        {
            throw new MychScriptError(stage, exception.message + " in expression", (source || this.source), expressionOffset + exception.offset, exception);
        }

        throw new MychScriptError(stage, exception + " in expression", this.source, expressionOffset, exception);
    }

    rethrowTemplateError(stage, exception, templateOffset)
    {
        if (exception instanceof MychTemplateError)
        {
            throw new MychScriptError(stage, exception.message + " in template", this.source, templateOffset + exception.offset, exception);
        }

        throw new MychScriptError(stage, exception + " in template", this.source, templateOffset, exception);
    }

    static commands =
    {
        script:
        {
            execute: function*(variables)
            {
                let nestedScriptExit = yield* this.executeNestedScripts(variables);
                return this.propagateExitOnReturn(nestedScriptExit);
            }
        },

        exit:
        {
            tokens:
            {
                exit:   [ /(?<type>\w+)/u ],
                exitif: [ /(?<type>\w+)/u, "if", /(?<expression>.+)/u ],
            },

            parse: function(args, parentScripts)
            {
                this.definition.type = args.type.value;

                if (!parentScripts.some(script => script.type == this.definition.type))
                {
                    throw new MychScriptError("parse", "unexpected block exit", this.source, args.type.offset);
                }

                if (args.expression)
                {
                    try
                    {
                        this.definition.expressionOffset = args.expression.offset;
                        this.definition.expression = new MychExpression(args.expression.value, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                    }
                }

                this.complete = true;
            },

            execute: function*(variables)
            {
                if (this.definition.expression)
                {
                    let exitCondition;

                    try
                    {
                        exitCondition = yield* this.definition.expression.evaluate(variables);
                    }
                    catch (exception)
                    {
                        branchScript.rethrowExpressionError("execute", exception, branchScript.definition.expressionOffset);
                    }

                    if (!MychExpression.coerceBoolean(exitCondition))
                    {
                        return;
                    }
                }

                return new MychScriptExit(this.definition.type);
            },
        },

        if:
        {
            tokens: [ /(?<expression>.+)/u ],

            parse: function(args)
            {
                let branch = { nestedScriptOffset: 0 };

                this.definition.branches = [branch];
                this.definition.branchElse = undefined;

                try
                {
                    this.definition.expressionOffset = args.expression.offset;
                    this.definition.expression = new MychExpression(args.expression.value, this.context);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                }
            },

            execute: function*(variables)
            {
                let elseBranch = this.definition.elseBranch;

                for (let branchIndex = 0; branchIndex < this.definition.branches.length; ++branchIndex)
                {
                    let branch = this.definition.branches[branchIndex];
                    let branchScript = (branchIndex == 0 ? this : this.nestedScripts[branch.nestedScriptOffset]);

                    let branchCondition;

                    try
                    {
                        branchCondition = yield* branchScript.definition.expression.evaluate(variables);
                    }
                    catch (exception)
                    {
                        branchScript.rethrowExpressionError("execute", exception, branchScript.definition.expressionOffset);
                    }
    
                    if (MychExpression.coerceBoolean(branchCondition))
                    {
                        let nextBranch = this.definition.branches[branchIndex + 1] || elseBranch || { nestedScriptOffset: this.nestedScripts.length };

                        let branchNestedScriptExit = yield* this.executeNestedScripts(variables, branch.nestedScriptOffset, nextBranch.nestedScriptOffset);
                        return this.propagateExitOnReturn(branchNestedScriptExit);
                    }
                }

                if (elseBranch)
                {
                    let elseNestedScriptExit = yield* this.executeNestedScripts(variables, elseBranch.nestedScriptOffset);
                    return this.propagateExitOnReturn(elseNestedScriptExit);
                }
            },
        },

        else:
        {
            tokens:
            {
                else:   [],
                elseif: [ "if", /(?<expression>.+)/u ],
            },

            parse: function(args, parentScripts)
            {
                let parentScript = parentScripts[parentScripts.length - 1];

                if (!parentScript || parentScript.type != "if")
                {
                    throw new MychScriptError("parse", "unexpected \"else\" outside of \"if\" block", this.source, 0);
                }

                if (args.expression)
                {
                    let branch = { nestedScriptOffset: parentScript.nestedScripts.length };

                    try
                    {
                        this.definition.expressionOffset = args.expression.offset;
                        this.definition.expression = new MychExpression(args.expression.value, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                    }

                    parentScript.definition.branches.push(branch);
                }
                else
                {
                    if (parentScript.definition.elseBranch)
                    {
                        throw new MychScriptError("parse", "unexpected \"else\" after previous \"else\" in same \"if\" block", this.source, 0);
                    }

                    parentScript.definition.elseBranch = { nestedScriptOffset: parentScript.nestedScripts.length };
                }

                this.complete = true;
            },
        },

        for:
        {
            tokens: [ /(?<variable>[\p{L}_][\p{L}\p{N}_]*)/u, "in", /(?<expression>.+)/u ],

            parse: function(args)
            {
                this.definition.variable = args.variable.value;

                try
                {
                    this.definition.expressionOffset = args.expression.offset;
                    this.definition.expression = new MychExpression(args.expression.value, this.context);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                }
            },

            execute: function*(variables)
            {
                let collection;

                try
                {
                    collection = yield* this.definition.expression.evaluate(variables);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                }

                let items = MychExpression.coerceList(collection);

                for (let item of items)
                {
                    variables.$setProperty(this.definition.variable, item);

                    let nestedScriptExit = yield* this.executeNestedScripts(variables);
                    
                    if (nestedScriptExit)
                    {
                        // keep current value of loop variable
                        return this.propagateExitOnReturn(nestedScriptExit);
                    }
                }

                variables.$removeProperty(this.definition.variable);
            },
        },

        set:
        {
            tokens:
            {
                assign:         [ /(?<variable>[\p{L}_][\p{L}\p{N}_]*)/u, "=", /(?<expression>.+)/u ],
                customrequired: [ "customizable", /(?<customizable>)(?<variable>[\p{L}_][\p{L}\p{N}_]*)/u ],
                customdefault:  [ "customizable", /(?<customizable>)(?<variable>[\p{L}_][\p{L}\p{N}_]*)/u, "=", /(?<expression>.+)/u ],
            },
            
            parse: function(args)
            {
                this.definition.variable = args.variable.value;
                this.definition.customizable = args.customizable != undefined;

                if (args.expression)
                {
                    try
                    {
                        this.definition.expressionOffset = args.expression.offset;
                        this.definition.expression = new MychExpression(args.expression.value, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                    }
                }

                this.complete = true;
            },
            
            execute: function*(variables)
            {
                if (this.definition.customizable)
                {
                    if (variables.$customizations.hasOwnProperty(this.definition.variable))
                    {
                        let customization = variables.$customizations[this.definition.variable];

                        if (!(customization instanceof MychScriptContext.Default))
                        {
                            variables.$setProperty(this.definition.variable, customization);
                            return;
                        }
                    }

                    if (!this.definition.expression)
                    {
                        throw new MychScriptError("execute", "require customization or default", this.source, this.source.length);
                    }
                }

                try
                {
                    let value = yield* this.definition.expression.evaluate(variables);
                    variables.$setProperty(this.definition.variable, value);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                }
            },

            getCustomization: function(variables)
            {
                if (!this.definition.customizable)
                {
                    return undefined;
                }

                let customizationKey = "set." + this.definition.variable;
                let customizationCommand = "set " + this.definition.variable;

                if (variables.$customizations.hasOwnProperty(this.definition.variable))
                {
                    let customization = variables.$customizations[this.definition.variable];
                    customizationCommand += " = " + (customization instanceof MychScriptContext.Default ? "default" : MychExpression.literal(customization));
                }
                else if (this.definition.expression)
                {
                    if (this.definition.expression.isConstant())
                    {
                        let constantExpressionResult = this.definition.expression.evaluateConstant();
                        customizationCommand += " = " + MychExpression.literal(constantExpressionResult);
                    }
                    else
                    {
                        // no customization: evaluate default at script runtime
                        customizationCommand += " = default";
                    }
                }
                else
                {
                    // no customization and no default: show thinking face emoji
                    customizationCommand += " = \u{1F914}";
                }

                return [customizationKey, customizationCommand];
            },
        },

        publish:
        {
            tokens: [ "to", /(?<scope>sender|game)/u, ":", /(?<identifiers>([\p{L}_][\p{L}\p{N}_]*)(\s*,\s*([\p{L}_][\p{L}\p{N}_]*))*)/u ],
        
            parse: function(args)
            {
                this.definition.scope = args.scope.value;
                this.definition.identifiers = args.identifiers.value.split(/\s*,\s*/);
            
                if (this.definition.scope == "game" && !MychScriptContext.$isPrivileged(this.context.playerid))
                {
                    throw new MychScriptError("parse", "publishing to game scope requires GM privileges", this.source, args.scope.offset);
                }

                this.complete = true;
            },

            execute: function*(variables)
            {
                let scopeVariables;

                switch (this.definition.scope)
                {
                    case "sender":
                    {
                        let player = MychScriptContext.players[this.context.playerid];
                        scopeVariables = player.globals;
                    }
                    break;

                    case "game":
                    {
                        scopeVariables = MychScriptContext.globals;
                    }
                    break;
                }

                for (let identifier of this.definition.identifiers)
                {
                    let value = variables.$getProperty(identifier, this.context, false);
                    scopeVariables.$setProperty(identifier, value);
                }
            },
        },

        do:
        {
            tokens: [ /(?<expression>.+)/u ],

            parse: function(args)
            {
                try
                {
                    this.definition.expressionOffset = args.expression.offset;
                    this.definition.expression = new MychExpression(args.expression.value, this.context);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                }

                this.complete = true;
            },

            execute: function*(variables)
            {
                try
                {
                    yield* this.definition.expression.evaluate(variables);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                }
            },
        },

        chat:
        {
            tokens:
            {
                newline:  [ ":" ],
                template: [ ":", /(?<template>.+)/u ],
                custom:   [ "[", /(?<label>\w+)/u, "]", ":", /(?<template>.+)/u ]
            },

            parse: function(args)
            {
                if (args.template)
                {
                    try
                    {
                        this.definition.templateOffset = args.template.offset;
                        this.definition.template = new MychTemplate(args.template.value, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowTemplateError("parse", exception, this.definition.templateOffset);
                    }

                    if (args.label)
                    {
                        this.definition.label = args.label.value;
                    }
                }

                this.complete = true;
            },

            execute: function*(variables)
            {
                let message;

                if (this.definition.template)
                {
                    let translationTemplate = variables.$customizations.$translations && variables.$customizations.$translations[this.definition.label];
                    let evaluateTemplate = (translationTemplate ? this.definition.template.createTranslated(translationTemplate) : this.definition.template);

                    try
                    {
                        message = yield* evaluateTemplate.evaluate(variables);
                    }
                    catch (exception)
                    {
                        this.rethrowTemplateError("execute", exception, this.definition.templateOffset);
                    }
                }
                else
                {
                    message = "<br/>";
                }

                let chatContext = (variables.chat instanceof Function) ? variables : this.context;
                chatContext.chat(variables.sender || this.context.sender, message);
            },

            getCustomization: function(variables)
            {
                if (!this.definition.label)
                {
                    return undefined;
                }

                let translationTemplate = variables.$customizations.$translations && variables.$customizations.$translations[this.definition.label];
                let customizationTemplate = (translationTemplate ? this.definition.template.createTranslated(translationTemplate) : this.definition.template);

                let customizationKey = "chat." + this.definition.label;
                let customizationCommand = "translate [" + this.definition.label + "]: " + customizationTemplate.getSourceWithReferences();

                return [customizationKey, customizationCommand];
            },
        },

        combine:
        {
            tokens:
            {
                chat:    [ "chat" ],
                chatsep: [ "chat", "using", /(?<expression>.+)/u ],
            },

            parse: function(args)
            {
                if (args.expression)
                {
                    try
                    {
                        this.definition.expressionOffset = args.expression.offset;
                        this.definition.expression = new MychExpression(args.expression.value, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                    }
                }
            },

            execute: function*(variables)
            {
                let separator = " ";

                if (this.definition.expression)
                {
                    try
                    {
                        separator = yield* this.definition.expression.evaluate(variables);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                    }
                }

                let combineNestedScriptExit;

                let collectedNameOrId;
                let collectedMessages = [];
                
                let variablesToRestore = ("chat" in variables) ? { chat: variables.chat } : {};

                try
                {
                    variables.chat = function(nameOrId_or_message, message_if_nameOrId = undefined)
                    {
                        if (arguments.length == 1)
                        {
                            collectedMessages.push(nameOrId_or_message);
                        }
                        else
                        {
                            collectedNameOrId = nameOrId_or_message;
                            collectedMessages.push(message_if_nameOrId);
                        }
                    };

                    combineNestedScriptExit = yield* this.executeNestedScripts(variables);
                }
                finally
                {
                    ("chat" in variablesToRestore) ? variables.chat = variablesToRestore.chat : delete variables.chat;
                }

                let combinedMessages =
                {
                    toScalar: () => collectedMessages.map(MychExpression.coerceString).join(MychExpression.coerceString(separator)),
                    toMarkup: () => collectedMessages.map(MychExpression.coerceMarkup).join(MychExpression.coerceMarkup(separator)),
                };

                let chatContext = (variables.chat ? variables : this.context);
                chatContext.chat(collectedNameOrId || this.context.sender, combinedMessages);

                return this.propagateExitOnReturn(combineNestedScriptExit);
            },
        },

        function:
        {
            tokens: [ /(?<name>[\p{L}_][\p{L}\p{N}_]*)/u, "(", /(?<parameters>([\p{L}_][\p{L}\p{N}_]*)(\s*,\s*([\p{L}_][\p{L}\p{N}_]*))*)?/u, ")" ],

            parse: function(args)
            {
                this.definition.functionName = args.name.value;
                this.definition.functionParams = args.parameters ? args.parameters.value.split(/\s*,\s*/) : [];
            },

            execute: function*(variables)
            {
                let functionCommand = this;
                let functionParams = this.definition.functionParams;

                function* functionImpl(...args)
                {
                    let functionVariables = new MychScriptVariables(this);

                    functionVariables.$setProperty("script", this.script || this);

                    for (let functionParamIndex = 0; functionParamIndex < functionParams.length; ++functionParamIndex)
                    {
                        let functionParamValue = (functionParamIndex < args.length) ? args[functionParamIndex] : new MychScriptContext.Default();
                        functionVariables.$setProperty(functionParams[functionParamIndex], functionParamValue);
                    }

                    let functionExit = yield* functionCommand.executeNestedScripts(functionVariables);

                    return functionExit ? functionExit.result : undefined;
                }

                functionImpl.functionName = this.definition.functionName;
                functionImpl.functionParamCount = functionParams.length;
                functionImpl.functionParamNames = functionParams;

                variables.$setProperty(this.definition.functionName, functionImpl);
            },
        },

        return:
        {
            tokens:
            {
                retundef: [],
                retvalue: [ /(?<expression>.+)/u ],  
            },

            parse: function(args, parentScripts)
            {
                if (!parentScripts.some(script => script.type == "function"))
                {
                    throw new MychScriptError("parse", "unexpected \"return\" outside of \"function\" block", this.source, 0);
                }
                
                if (args.expression)
                {
                    try
                    {
                        this.definition.expressionOffset = args.expression.offset;
                        this.definition.expression = new MychExpression(args.expression.value, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                    }
                }

                this.complete = true;
            },

            execute: function*(variables)
            {
                let returnValue = undefined;

                if (this.definition.expression)
                {
                    try
                    {
                        returnValue = yield* this.definition.expression.evaluate(variables);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                    }
                }

                return new MychScriptExit("function", returnValue);
            },
        },

        $customizations:
        {
            execute: function*(variables)
            {
                let nestedScriptIndex;

                for (nestedScriptIndex = 0; nestedScriptIndex < this.nestedScripts.length; ++nestedScriptIndex)
                {
                    let nestedScript = this.nestedScripts[nestedScriptIndex];

                    if (variables.$customizations.$export && nestedScript.type != "customize")
                    {
                        break;
                    }

                    try
                    {
                        let nestedScriptExit = yield* this.executeNestedScripts(variables, nestedScriptIndex, nestedScriptIndex + 1);

                        if (nestedScriptExit)
                        {
                            // redundant as there is no valid command to exit $customizations block
                            return this.propagateExitOnReturn(nestedScriptExit);
                        }
                    }
                    catch (exception)
                    {
                        if (nestedScript.type != "customize")
                        {
                            throw exception;
                        }

                        exception.stage = "customize";
                        this.context.whisperback(exception);
    
                        continue;
                    }
                }

                if (!variables.$customizations.$export)
                {
                    return undefined;
                }
                
                function* gatherCustomizations(script)
                {
                    for (let nestedScript of script.nestedScripts)
                    {
                        if (nestedScript.getCustomization)
                        {
                            let nestedCustomization = nestedScript.getCustomization(variables);
                            
                            if (nestedCustomization)
                            {
                                yield nestedCustomization;
                            }
                        }

                        yield* gatherCustomizations(nestedScript);
                    }
                }

                let customizationCommands = {};

                for (let exportedNestedScript of this.nestedScripts.slice(nestedScriptIndex))
                {
                    for (let [customizationKey, customizationCommand] of gatherCustomizations(exportedNestedScript))
                    {
                        customizationCommands[customizationKey] || (customizationCommands[customizationKey] = customizationCommand);
                    }
                }

                let customizationBlock = [];

                customizationBlock.push("customize");
                customizationBlock.push(...Object.values(customizationCommands).map(command => "   " + command));
                customizationBlock.push("end customize");

                let customizationBlockSource = customizationBlock.map(line => line + "\n").join("");
                this.context.$exportScript(variables.$customizations.$export.destination, customizationBlockSource, variables.$customizations.$export.backup);

                return undefined;
            },
        },

        customize:
        {
            tokens:
            {
                block:         [],
                exportbackup:  [ "export", "to", /(?<destination>\w+)(?<backup>)/u ],
                exportreplace: [ "export", "to", /(?<destination>\w+)/u, "without", "backup" ],
            },

            parse: function(args)
            {
                if (args.destination)
                {
                    this.definition.export = true;
                    this.definition.exportDestination = args.destination.value;
                    this.definition.exportBackup = !!args.backup;

                    this.complete = true;
                }
            },

            execute: function*(variables)
            {
                if (this.definition.export)
                {
                    variables.$customizations.$export = { destination: this.definition.exportDestination, backup: this.definition.exportBackup };
                }
                else
                {
                    let nestedVariables = Object.create(variables);
                    let nestedScriptExit = yield* this.executeNestedScripts(nestedVariables);

                    variables.$integrateCustomizations(nestedVariables);

                    return this.propagateExitOnReturn(nestedScriptExit);
                }
            },
        },

        translate:
        {
            tokens: [ "[", /(?<label>\w+)/u, "]", ":", /(?<template>.+)/u ],

            parse: function(args)
            {
                this.definition.label = args.label.value;

                try
                {
                    this.definition.templateOffset = args.template.offset;
                    this.definition.template = new MychTemplate(args.template.value, this.context);
                }
                catch (exception)
                {
                    this.rethrowTemplateError("parse", exception, this.definition.templateOffset);
                }

                this.complete = true;
            },

            execute: function*(variables)
            {
                let translation;

                try
                {
                    translation = yield* this.definition.template.createMaterialized(variables);
                }
                catch (exception)
                {
                    this.rethrowTemplateError("execute", exception, this.definition.templateOffset);
                }
                
                variables.$translations || (variables.$translations = {});
                variables.$translations[this.definition.label] = translation;
            }
        },

        debug:
        {
            tokens:
            {
                chat:      [ "chat", ":", /(?<template>.+)/u ],
                chatlabel: [ "chat", "[", /(?<label>\w+)/u, "]", ":", /(?<template>.+)/u],
                do:        [ "do", /(?<expression>.+)/u ],
            },

            parse: function(args)
            {
                if (args.template)
                {
                    try
                    {
                        this.definition.templateOffset = args.template.offset;
                        this.definition.template = new MychTemplate(args.template.value, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowTemplateError("parse", exception, this.definition.templateOffset);
                    }
                }

                if (args.label)
                {
                    this.definition.label = args.label.value;
                }

                if (args.expression)
                {
                    try
                    {
                        this.definition.expressionOffset = args.expression.offset;
                        this.definition.expression = new MychExpression(args.expression.value, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("parse", exception, this.definition.expressionOffset);
                    }
                }

                this.complete = true;
            },

            execute: function*(variables)
            {
                if (this.definition.template)
                {
                    let message;

                    try
                    {
                        message = yield* this.definition.template.evaluate(variables, value => this.context.$debugExpression(value));
                    }
                    catch (exception)
                    {
                        this.rethrowTemplateError("execute", exception, this.definition.templateOffset);
                    }

                    this.context.$debugSendMessage(message);
                }

                if (this.definition.expression)
                {
                    let result;

                    try
                    {
                        result = yield* this.definition.expression.evaluate(variables);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                    }

                    this.context.$debugSendExpression(result, this.definition.expression.source);
                }
            },
        },
    };

    static parseTokens(tokenPatterns, source, sourceOffset)
    {
        let args = {};

        let whitespaceRegExp = /\s*/ug;

        for (let tokenPattern of tokenPatterns)
        {
            whitespaceRegExp.lastIndex = sourceOffset;
            let whitespaceMatch = whitespaceRegExp.exec(source);

            if (!whitespaceMatch || whitespaceMatch.index != sourceOffset)
            {
                return [sourceOffset, undefined];
            }

            sourceOffset = whitespaceMatch.index + whitespaceMatch[0].length;

            let tokenRegExpSource = (tokenPattern instanceof RegExp) ? tokenPattern.source : MychExpression.createTokenRegExpSource(tokenPattern);
            let tokenRegExp = new RegExp(tokenRegExpSource, "uig");

            tokenRegExp.lastIndex = sourceOffset;
            let tokenMatch = tokenRegExp.exec(source);

            if (!tokenMatch || tokenMatch.index != sourceOffset)
            {
                return [sourceOffset, undefined];
            }

            if (tokenMatch.groups)
            {
                for (let [argName, argValue] of Object.entries(tokenMatch.groups))
                {
                    if (argValue != undefined)
                    {
                        args[argName] = { offset: sourceOffset, value: argValue };
                    }
                }
            }

            sourceOffset = tokenMatch.index + tokenMatch[0].length;
        }

        whitespaceRegExp.lastIndex = sourceOffset;
        let whitespaceMatch = whitespaceRegExp.exec(source);

        if (!whitespaceMatch || whitespaceMatch.index != sourceOffset)
        {
            return [sourceOffset, undefined];
        }

        sourceOffset = whitespaceMatch.index + whitespaceMatch[0].length;

        return [sourceOffset, args];
    }

    static parseCommand(source)
    {
        for (let commandType in MychScript.commands)
        {
            let [sourceOffset, commandTypeArgs] = MychScript.parseTokens([commandType], source, 0);

            if (!commandTypeArgs)
            {
                continue;
            }

            let command = MychScript.commands[commandType];

            if (command.tokens)
            {
                let commandTokensAlternatives = (Array.isArray(command.tokens) ? [command.tokens] : Object.values(command.tokens));
                let maxSourceOffsetAlternative = sourceOffset;

                for (let commandTokens of commandTokensAlternatives)
                {
                    let [sourceOffsetAlternative, commandArgs] = MychScript.parseTokens(commandTokens, source, sourceOffset);

                    if (sourceOffsetAlternative == source.length && commandArgs)
                    {
                        return [commandType, commandArgs];
                    }

                    if (sourceOffsetAlternative > maxSourceOffsetAlternative)
                    {
                        maxSourceOffsetAlternative = sourceOffsetAlternative;
                    }
                }

                throw new MychScriptError("parse", "syntax error", source, maxSourceOffsetAlternative);
            }
            else
            {
                if (sourceOffset == source.length)
                {
                    return [commandType, {}];
                }

                throw new MychScriptError("parse", "syntax error", source, sourceOffset);
            }
        }

        let [sourceOffset] = MychScript.parseTokens([], source, 0);

        throw new MychScriptError("parse", "unknown command", source, sourceOffset);
    }

    addCommand(source, context, parentScripts = [])
    {
        if (this.complete)
        {
            throw new MychScriptError("parse", "unexpected command", source, 0);
        }

        if (!this.type)
        {
            let [commandType, commandArgs] = MychScript.parseCommand(source);

            let command = MychScript.commands[commandType];

            this.type = commandType;
            this.source = source;
            this.context = context;

            if (command.parse)
            {
                command.parse.call(this, commandArgs, parentScripts || []);
            }

            this.execute = (command.execute || function*() {});
            this.getCustomization = command.getCustomization;
        
            return this;
        }
        else
        {
            let nestedScript = this.nestedScripts[this.nestedScripts.length - 1];

            if (nestedScript && !nestedScript.complete)
            {
                return nestedScript.addCommand(source, context, parentScripts.concat(this));
            }

            let [endSourceOffset, endCommandArgs] = MychScript.parseTokens([ "end", /(?<type>\w+)/u ], source, 0);

            if (endCommandArgs)
            {
                if (endSourceOffset != source.length)
                {
                    throw new MychScriptError("parse", "syntax error", source, endSourceOffset);
                }

                if (endCommandArgs.type.value != this.type)
                {
                    let endParentScriptIndex = parentScripts.map(script => script.type).lastIndexOf(endCommandArgs.type.value);

                    if (endParentScriptIndex >= 0)
                    {
                        for (let parentScript of parentScripts.slice(endParentScriptIndex))
                        {
                            parentScript.complete = true;
                        }
                    }

                    throw new MychScriptError("parse", "unexpected block end", source, endCommandArgs.type.offset);
                }

                this.complete = true;

                return this;
            }

            nestedScript = new MychScript();
            nestedScript.addCommand(source, context, parentScripts.concat(this));
        
            this.nestedScripts.push(nestedScript);

            return nestedScript;
        }
    }

    *executeNestedScripts(variables, startIndex = undefined, endIndex = undefined)
    {
        for (let nestedScript of this.nestedScripts.slice(startIndex, endIndex))
        {
            let nestedScriptExit = yield* nestedScript.execute(variables);

            if (nestedScriptExit)
            {
                return nestedScriptExit;
            }
        }

        return undefined;
    }

    propagateExitOnReturn(nestedScriptExit)
    {
        if (nestedScriptExit && nestedScriptExit.type == this.type)
        {
            return undefined;
        }

        return nestedScriptExit;
    }

    startExecute(variables)
    {
        let scriptExecuteGenerator = this.execute(variables);
        this.continueExecute(scriptExecuteGenerator, undefined);
    }

    continueExecute(scriptExecuteGenerator, result)
    {
        try
        {
            let scriptExecuteResult = scriptExecuteGenerator.next(result);

            if (scriptExecuteResult.value)
            {
                let nextScriptExecuteContinuation = scriptExecuteResult.value;
                nextScriptExecuteContinuation(this, scriptExecuteGenerator);
            }
        }
        catch (exception)
        {
            this.context.error(exception);
        }
    }

    static continueExecuteOnCallback(callbackSetup = function(resultCallback) {})
    {
        function scriptExecuteContinuation(script, scriptExecuteGenerator)
        {
            function resultCallback(result)
            {
                script.continueExecute(scriptExecuteGenerator, result);
            }

            callbackSetup(resultCallback);
        }

        return scriptExecuteContinuation;
    }
}

class MychTemplateError
{
    constructor(stage, message, source, offset, cause = undefined)
    {
        this.stage = stage;
        this.message = message;
        this.source = source;
        this.offset = offset;
        this.cause = cause;
    }

    toString()
    {
        return "During " + this.stage + ", " + this.message + " in template: " + this.source.substring(0, this.offset) + "\u274C" + this.source.substring(this.offset);
    }
}

class MychTemplate
{
    constructor(source, context)
    {
        this.source = undefined;
        this.context = undefined;
        this.segments = [];
        this.expressionSegments = {};

        if (source != undefined)
        {
            this.parse(source, context);
        }
    }

    rethrowExpressionError(stage, exception, expressionOffset)
    {
        if (exception instanceof MychExpressionError)
        {
            throw new MychTemplateError(stage, exception.message + " in expression", this.source, expressionOffset + exception.offset, exception);
        }

        throw new MychTemplateError(stage, exception + " in expression", this.source, expressionOffset, exception);
    }

    static createSegmentRegExp(context)
    {
        let segmentPatterns =
        [   
            /\\(?<escape>.)/u,
            /\$(?=(?<labelToken>\[(?<label>\w+)\])?(?<expressionToken>\{(?<expression>([^"'}]|"([^\\"]|\\.)*"|'([^\\']|\\.)*')*)\})?)(\k<labelToken>\k<expressionToken>|\k<labelToken>|\k<expressionToken>)/u,
        ];

        let contextKeys = Object.keys(context).filter(key => /^([^\p{L}\p{N}_]|[^\p{L}\p{N}_].*[^\p{L}\p{N}_])$/u.test(key));

        if (contextKeys.length > 0)
        {
            let contextKeysRegExpSources = contextKeys.map(MychExpression.createTokenRegExpSource);
            segmentPatterns.unshift("(?<context>" + contextKeysRegExpSources.join("|") + ")");
        }

        function createSegmentRegExpSource(pattern)
        {
            return "(" + (pattern instanceof RegExp ? pattern.source : pattern) + ")";
        }

        return new RegExp(segmentPatterns.map(createSegmentRegExpSource).join("|"), "ug");
    }

    parse(source, context)
    {
        if (context == undefined)
        {
            throw "MychTemplate internal error: no parse context";
        }

        this.source = source;
        this.context = context;
        this.segments = [];

        let segmentRegExp = MychTemplate.createSegmentRegExp(context);
        let segmentMatch;

        let segmentOffset = 0;

        while (segmentMatch = segmentRegExp.exec(source))
        {
            if (segmentOffset < segmentMatch.index)
            {
                let stringValue = source.substring(segmentOffset, segmentMatch.index);
                
                let stringSegment =
                {
                    type: "string",
                    value: stringValue,
                    source: stringValue,
                };

                this.segments.push(stringSegment);
            }

            if (segmentMatch.groups.context)
            {
                let contextKey = segmentMatch.groups.context;
                let contextValue = context[contextKey];

                let contextSegment =
                {
                    type: "context",
                    value: contextValue,
                    source: segmentMatch[0],
                };

                this.segments.push(contextSegment);
            }
            else if (segmentMatch.groups.escape)
            {
                let string = segmentMatch.groups.escape;

                let stringSegment =
                {
                    type: "string",
                    value: string,
                    source: segmentMatch[0],
                };

                this.segments.push(stringSegment);
            }
            else if (segmentMatch.groups.expression)
            {
                let expressionLabel = segmentMatch.groups.label;
                let expressionOffset = segmentMatch.index + "$".length + (segmentMatch.groups.labelToken ? segmentMatch.groups.labelToken.length : 0) + "{".length;

                try
                {
                    let expression = new MychExpression(segmentMatch.groups.expression, context);

                    let expressionSegment =
                    {
                        type: "expression",
                        offset: expressionOffset,
                        expression: expression,
                        label: expressionLabel,
                        source: segmentMatch[0],
                    };

                    if (expressionLabel)
                    {
                        this.expressionSegments[expressionLabel] = expressionSegment;
                    }

                    this.segments.push(expressionSegment);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, expressionOffset);
                }
            }
            else if (segmentMatch.groups.label)
            {
                let referenceLabel = segmentMatch.groups.label;
                
                let referenceSegment =
                {
                    type: "reference",
                    label: referenceLabel,
                    source: segmentMatch[0],
                };
                
                this.segments.push(referenceSegment);
            }

            segmentOffset = segmentMatch.index + segmentMatch[0].length;
        }

        if (segmentOffset < source.length)
        {
            let stringValue = source.substring(segmentOffset);

            let stringSegment =
            {
                type: "string",
                value: stringValue,
                source: stringValue,
            };

            this.segments.push(stringSegment);
        }
    }

    getSourceWithReferences()
    {
        function reconstructSegment(segment)
        {
            if (segment.type == "expression")
            {
                return segment.label ? ("$[" + segment.label + "]") : "...";
            }
            
            return segment.source;
        }

        return this.segments.map(reconstructSegment).join("");
    }

    *evaluate(variables, convertExpression = value => value)
    {
        let evaluatedSegments = [];

        for (let segment of this.segments)
        {
            switch (segment.type)
            {
                case "string":
                {
                    let evaluatedString = segment.value;
                    evaluatedSegments.push(evaluatedString);
                }
                break;

                case "context":
                {
                    let evaluatedContext = segment.value;
                    evaluatedSegments.push(evaluatedContext);
                }
                break;

                case "expression":
                {
                    try
                    {
                        let evaluatedExpressionResult = yield* segment.expression.evaluate(variables);
                        evaluatedSegments.push(convertExpression(evaluatedExpressionResult));
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("evaluate", exception, segment.offset);
                    }
                }
                break;

                case "reference":
                {
                    let evaluatedReference = "$[" + segment.label + "]";
                    evaluatedSegments.push(evaluatedReference);
                }
                break;
            }
        }

        if (evaluatedSegments.length <= 1)
        {
            return evaluatedSegments[0];
        }

        let combinedEvaluatedSegments =
        {
            toScalar: () => evaluatedSegments.map(MychExpression.coerceString).join(""),
            toMarkup: () => evaluatedSegments.map(MychExpression.coerceMarkup).join(""),
        };

        return combinedEvaluatedSegments;
    }

    createTranslated(translationTemplate)
    {
        let translatedTemplate = new MychTemplate();

        translatedTemplate.source = this.source;
        translatedTemplate.context = this.context;
        translatedTemplate.expressionSegments = this.expressionSegments;
        translatedTemplate.segments = translationTemplate.segments.map(segment => (segment.type == "reference" ? this.expressionSegments[segment.label] : undefined) || segment);

        return translatedTemplate;
    }

    *createMaterialized(variables, convertExpression = value => value)
    {
        let materializedTemplate = new MychTemplate();

        materializedTemplate.source = this.source;
        materializedTemplate.context = this.context;
        materializedTemplate.expressionSegments = {};

        for (let segment of this.segments)
        {
            switch (segment.type)
            {
                case "string":
                {
                    let materializedString = segment.value;

                    let materializedStringSegment =
                    {
                        type: "string",
                        value: materializedString,
                        source: materializedString,
                    };

                    materializedTemplate.segments.push(materializedStringSegment);
                }
                break;

                case "context":
                {
                    materializedTemplate.segments.push(segment);
                }
                break;

                case "expression":
                {
                    try
                    {
                        let materializedExpressionResult = yield* segment.expression.evaluate(variables);
                        let materializedExpressionString = convertExpression(materializedExpressionResult);

                        let materializedExpressionSegment =
                        {
                            type: "string",
                            value: materializedExpressionString,
                            source: materializedExpressionString,
                        };

                        materializedTemplate.segments.push(materializedExpressionSegment);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("materialize", exception, segment.offset);
                    }
                }
                break;

                case "reference":
                {
                    materializedTemplate.segments.push(segment);
                }
                break;
            }
        }

        return materializedTemplate;
    }
}

class MychExpressionError
{
    constructor(stage, message, source, offset, cause = undefined)
    {
        this.stage = stage;
        this.message = message;
        this.source = source;
        this.offset = offset;
        this.cause = cause;
    }

    toString()
    {
        return "During " + this.stage + ", " + this.message + " in expression: " + this.source.substring(0, this.offset) + "\u274C" + this.source.substring(this.offset);
    }
}

class MychExpressionArgs extends Array
{
    // marker subclass for comma-separated argument lists in expressions
}

class MychExpression
{
    constructor(source, context)
    {
        this.source = undefined;
        this.context = context;
        this.tokens = [];
        this.evaluator = undefined;
    
        if (source != undefined)
        {
            this.parse(source, context);
        }
    }

    static createLiteralRegExpSource(literal, addWordBoundaryAssertions = false)
    {
        let requireWordBoundaryAssertionBegin = false;
        let requireWordBoundaryAssertionEnd = false;

        if (addWordBoundaryAssertions)
        {
            requireWordBoundaryAssertionBegin = /^[\p{L}\p{N}_]/u.test(literal);
            requireWordBoundaryAssertionEnd = /[\p{L}\p{N}_]$/u.test(literal);
        }

        let literalRegExpSource = literal.replace(/([\\.^$()\[\]{}|*+?])/ug, "\\$1");

        if (requireWordBoundaryAssertionBegin)
        {
            literalRegExpSource = /(?<![\p{L}\p{N}_])/u.source + literalRegExpSource;
        }

        if (requireWordBoundaryAssertionEnd)
        {
            literalRegExpSource = literalRegExpSource + /(?![\p{L}\p{N}_])/u.source;
        }

        return literalRegExpSource;
    }

    static createTokenRegExpSource(token)
    {
        return MychExpression.createLiteralRegExpSource(token, true);
    }

    static coerceScalar(value)
    {
        if (Array.isArray(value))
        {
            return value[value.length - 1];
        }

        if (value && value.toScalar instanceof Function)
        {
            return value.toScalar();
        }

        return value;
    }

    static coerceMarkup(value)
    {
        if (value && value.toMarkup instanceof Function)
        {
            return value.toMarkup();
        }

        if (value && value.toScalar instanceof Function)
        {
            return MychExpression.coerceMarkup(value.toScalar());
        }

        return MychExpression.coerceString(value);
    }

    static coerceString(value)
    {
        if (Array.isArray(value))
        {
            return value.map(MychExpression.coerceString).join(", ");
        }

        value = MychExpression.coerceScalar(value);

        if (value == undefined || value == null)
        {
            return "";
        }

        if (value instanceof Function)
        {
            let name = value.functionName || value.name;
            let paramCount = value.functionParamCount || value.length;
            let paramNames = value.functionParamNames || [...Array(paramCount).keys()].map(index => "param" + (index + 1));
            
            return name + "(" + paramNames.join(", ") + ")";
        }

        return String(value);
    }

    static coerceNumber(value)
    {
        value = MychExpression.coerceScalar(value);

        switch (typeof(value))
        {
            case "number":
            {
                return value;
            }

            case "boolean":
            {
                return (value ? 1 : 0);
            }

            case "string": 
            {
                value = parseFloat(value);
                return (isNaN(value) ? 0 : value);
            }
        }

        return 0;
    }

    static coerceBoolean(value)
    {
        value = MychExpression.coerceScalar(value);

        switch (typeof(value))
        {
            case "boolean":
            {
                return value;
            }

            case "number":
            {
                return (value != 0);
            }

            case "string": 
            {
                return (value.length > 0);
            }
        }

        return 0;
    }

    static coerceArgs(value)
    {
        if (value instanceof MychExpressionArgs)
        {
            return value;
        }

        return MychExpressionArgs.of(value);
    }

    static coerceList(value)
    {
        if (value instanceof MychExpressionArgs)
        {
            return [...value.flat().filter(item => item != undefined)];
        }

        if (Array.isArray(value))
        {
            return value;
        }

        if (value && value.toList instanceof Function)
        {
            return value.toList();
        }

        if (value == undefined)
        {
            return [];
        }

        return [value];
    }

    static *mapList(list, mapping = function*(item) {})
    {
        let mappedList = [];

        for (let item of list)
        {
            let mappedItem = yield* mapping(item);

            if (mappedItem == undefined)
            {
                continue;
            }

            if (Array.isArray(mappedItem))
            {
                mappedList.push(...mappedItem.flat().filter(item => item != undefined));
            }
            else
            {
                mappedList.push(mappedItem);
            }
        }

        return mappedList;
    }

    static literal(value)
    {
        if (Array.isArray(value))
        {
            return value.map(MychExpression.literal).join(", ");
        }

        if (value instanceof Function)
        {
            return MychExpression.coerceString(value);
        }

        value = MychExpression.coerceScalar(value);

        switch (typeof(value))
        {
            case "string":
            {
                let stringLiteral = "\"" + value.replace(/(["\\])/ug, "\\$1") + "\"";
                return stringLiteral;
            }

            case "undefined":
            {
                return "undef";
            }
        }

        return String(value);
    }

    static rules =
    {
        unaryOperator:
        {
            description: "unary operator",
            tokenType: [ "unaryOperator", "unaryOrBinaryOperator" ],

            processToken: function(token, state, context)
            {
                let operatorDef = MychExpression.unaryOperatorDefs[token.value];

                let coerceValue = operatorDef.coerceValue || (value => value);

                function unaryOperator(evaluator)
                {
                    return function* unaryOperatorEvaluator(variables)
                    {
                        let value = coerceValue(yield* evaluator(variables));
                        return operatorDef.evaluate(value);
                    }
                }

                state.pushOperator(token, unaryOperator, operatorDef.precedence, { isIdempotent: true });
            },

            nextRuleNames: new Set(
            [
                "unaryOperator",
                "debugOperator",
                "literal",
                "symbolLookup",
                "anonymousLookup",
                "openingParenthesis",
            ]), 
        },
        binaryOperator:
        {
            description: "binary operator",
            tokenType: [ "binaryOperator", "unaryOrBinaryOperator" ],

            processToken: function(token, state, context)
            {
                let operatorDef = MychExpression.binaryOperatorDefs[token.value];

                let coerceValueA = operatorDef.coerceValueA || (value => value);
                let coerceValueB = operatorDef.coerceValueB || (value => value);

                function binaryOperator(evaluatorA, evaluatorB)
                {
                    if (operatorDef.evaluate.constructor.name != "GeneratorFunction")
                    {
                        return function* binaryOperatorEvaluator(variables)
                        {
                            let valueA = coerceValueA(yield* evaluatorA(variables));
                            let valueB = coerceValueB(yield* evaluatorB(variables));

                            return operatorDef.evaluate(valueA, valueB);
                        }
                    }
                    else
                    {
                        return function* binaryOperatorEvaluator(variables)
                        {
                            function createCoercedEvaluator(coerceValue, evaluator)
                            {
                                return function* coercedEvaluator(anonymousValue = undefined)
                                {
                                    return (arguments.length == 0)
                                        ? coerceValue(yield* evaluator(variables))
                                        : coerceValue(yield* evaluator(variables.$withAnonymousVariable(anonymousValue)));
                                }
                            }
    
                            let coercedEvaluatorA = createCoercedEvaluator(coerceValueA, evaluatorA);
                            let coercedEvaluatorB = createCoercedEvaluator(coerceValueB, evaluatorB);

                            return yield* operatorDef.evaluate(coercedEvaluatorA, coercedEvaluatorB);
                        }
                    }
                }

                state.pushOperator(token, binaryOperator, operatorDef.precedence, { isIdempotent: true });
            },

            nextRuleNames: new Set(
            [
                "unaryOperator",
                "debugOperator",
                "literal",
                "symbolLookup",
                "anonymousLookup",
                "openingParenthesis",
            ]),
        },
        propertyLookup:
        {
            description: "property lookup",
            tokenType: "propertyOperator",

            processToken: function(token, state, context)
            {
                function propertyLookupOperator(evaluatorStruct, evaluatorKey)
                {
                    return function* propertyLookupEvaluator(variables)
                    {
                        let valueStruct = yield* evaluatorStruct(variables);
                        let valueKey = MychExpression.coerceString(yield* evaluatorKey(variables));

                        if (valueStruct && valueStruct.$getProperty instanceof Function)
                        {
                            return valueStruct.$getProperty(valueKey, undefined, true);
                        }

                        return context.getprop(valueStruct, valueKey);
                    }
                }

                state.pushOperator(token, propertyLookupOperator, -1);
            },

            nextRuleNames: new Set(
            [
                "propertyName",
                "propertyExpression",
            ]),
        },
        propertyName:
        {
            description: "property name",
            tokenType: "identifier",

            processToken: function(token, state, context)
            {
                function* propertyNameEvaluator(variables)
                {
                    return token.value;
                }

                state.pushEvaluator(token, propertyNameEvaluator, { isConstant: true });
            },

            nextRuleNames: new Set(
            [
                "binaryOperator",
                "propertyLookup",
                "call",
                "listLookup",
                "closingParenthesis",
                "closingBracket",
                "endOfExpression",
            ]),
        },
        propertyExpression:
        {
            description: "opening parenthesis (for property expression)",
            tokenType: "openingParenthesis",

            processToken: function(token, state, context)
            {
                state.startGroup(token);
            },

            nextRuleNames: new Set(
            [
                "unaryOperator",
                "debugOperator",
                "literal",
                "symbolLookup",
                "anonymousLookup",
                "openingParenthesis",
            ]),
            closeRuleNames: new Set(
            [
                "closingParenthesis",
            ]),
        },
        debugOperator:
        {
            description: "debug operator",
            tokenType: "debugOperator",

            processToken: function(token, state, context)
            {
                let debugPrecedence;

                switch (token.value.length)
                {
                    case 1: debugPrecedence = MychExpression.minOperatorPrecedence - 1; break;
                    case 2: debugPrecedence = MychExpression.binaryOperatorDefs["<"].precedence - 1; break;
                    case 3: debugPrecedence = MychExpression.maxOperatorPrecedence + 1; break;
                }

                let prevOperator = state.operatorStack[state.operatorStack.length - 1];
                let maxDebugPrecedence = prevOperator ? prevOperator.precedence : MychExpression.maxOperatorPrecedence + 1;

                function debugOperator(evaluator)
                {
                    let resultSourceBegin = evaluator.sourceOffset;
                    let resultSourceEnd = evaluator.sourceOffset + evaluator.sourceLength;

                    return function* debugOperatorEvaluator(variables)
                    {
                        let result = yield* evaluator(variables);
                        context.$debugSendExpression(result, token.source, resultSourceBegin, resultSourceEnd);
                        return result;
                    }
                }

                state.pushOperator(token, debugOperator, Math.min(debugPrecedence, maxDebugPrecedence));
            },

            nextRuleNames: new Set(
            [
                "unaryOperator",
                "literal",
                "symbolLookup",
                "anonymousLookup",
                "openingParenthesis",
            ]),
        },
        symbolLookup:
        {
            description: "variable or function name",
            tokenType: "identifier",

            processToken: function(token, state, context)
            {
                function* symbolLookupEvaluator(variables)
                {
                    return variables.$getProperty(token.value, context, true);
                }

                state.pushEvaluator(token, symbolLookupEvaluator);
            },

            nextRuleNames: new Set(
            [
                "binaryOperator",
                "propertyLookup",
                "call",
                "listLookup",
                "closingParenthesis",
                "closingBracket",
                "endOfExpression",
            ]),
        },
        anonymousLookup:
        {
            description: "anonymous variable",
            tokenType: "anonymousIdentifier",

            processToken: function(token, state, context)
            {
                function* anonymousLookupEvaluator(variables)
                {
                    let anonymousValue = variables.$getAnonymousVariable();
                    return anonymousValue;
                }

                state.pushEvaluator(token, anonymousLookupEvaluator);
            },

            nextRuleNames: new Set(
            [
                "anonymousPropertyName",
                "anonymousPropertyExpression",
                "binaryOperator",
                "listLookup",
                "closingParenthesis",
                "closingBracket",
                "endOfExpression",
            ]),
        },
        anonymousPropertyName:
        {
            description: "property name",
            tokenType: "identifier",

            processToken: function(token, state, context)
            {
                state.processRule(context, "propertyLookup", { offset: token.offset, length: 0 });
                state.processRule(context, "propertyName", token)
            },

            nextRuleNames: new Set(
            [
                "binaryOperator",
                "propertyLookup",
                "call",
                "listLookup",
                "closingParenthesis",
                "closingBracket",
                "endOfExpression",
            ]),
        },
        anonymousPropertyExpression:
        {
            description: "opening parenthesis (for property expression)",
            tokenType: "openingParenthesis",

            processToken: function(token, state, context)
            {
                state.processRule(context, "propertyLookup", { offset: token.offset, length: 0 });
                state.processRule(context, "propertyExpression", token)
            },

            nextRuleNames: new Set(
            [
                "unaryOperator",
                "debugOperator",
                "literal",
                "symbolLookup",
                "anonymousLookup",
                "openingParenthesis",
            ]),
            closeRuleNames: new Set(
            [
                "closingParenthesis",
            ]),
        },
        literal:
        {
            description: "literal value",
            tokenType: "literal",

            processToken: function(token, state, context)
            {
                function* literalEvaluator(variables)
                {
                    return token.value;
                }

                state.pushEvaluator(token, literalEvaluator, { isConstant: true });
            },

            nextRuleNames: new Set(
            [
                "binaryOperator",
                "propertyLookup",
                "closingParenthesis",
                "closingBracket",
                "endOfExpression",
            ]),
        },
        call:
        {
            description: "opening parenthesis (for function arguments)",
            tokenType: "openingParenthesis",

            processToken: function(token, state, context)
            {
                function callOperator(funcEvaluator, argsEvaluator)
                {
                    return function* callEvaluator(variables)
                    {
                        let func = yield* funcEvaluator(variables);
                        let args = argsEvaluator ? MychExpression.coerceArgs(yield* argsEvaluator(variables)) : [];

                        if (func instanceof Function)
                        {
                            let funcResult = func(...args);
                            return (funcResult && funcResult.next) ? (yield* funcResult) : funcResult;
                        }

                        throw new MychExpressionError("evaluate", (func ? "invalid function" : "unknown function"), token.source, token.offset);
                    }
                }

                state.pushOperator(token, callOperator, -1);
                state.startGroup(token);
            },

            nextRuleNames: new Set(
            [
                "closingParenthesisEmpty",
                "unaryOperator",
                "debugOperator",
                "literal",
                "symbolLookup",
                "anonymousLookup",
                "openingParenthesis",
            ]),
            closeRuleNames: new Set(
            [
                "closingParenthesis",
                "closingParenthesisEmpty",
            ]),
        },
        openingParenthesis:
        {
            description: "opening parenthesis (for expression grouping)",
            tokenType: "openingParenthesis",

            processToken: function(token, state, context)
            {
                state.startGroup(token);
            },

            nextRuleNames: new Set(
            [
                "unaryOperator",
                "debugOperator",
                "literal",
                "symbolLookup",
                "anonymousLookup",
                "openingParenthesis",
            ]),
            closeRuleNames: new Set(
            [
                "closingParenthesis",
            ]),
        },
        closingParenthesis:
        {
            description: "closing parenthesis",
            tokenType: "closingParenthesis",

            processToken: function(token, state, context)
            {
                state.reduceGroup(token);
            },

            nextRuleNames: new Set(
            [
                "binaryOperator",
                "propertyLookup",
                "listLookup",
                "closingParenthesis",
                "closingBracket",
                "endOfExpression",
            ]),
        },
        closingParenthesisEmpty:
        {
            description: "closing parenthesis (for empty argument list)",
            tokenType: "closingParenthesis",

            processToken: function(token, state, context)
            {
                state.pushEvaluator(token, undefined, { isConstant: true });
                state.reduceGroup(token);
            },

            nextRuleNames: new Set(
            [
                "binaryOperator",
                "propertyLookup",
                "listLookup",
                "closingParenthesis",
                "closingBracket",
                "endOfExpression",
            ]),
        },
        listLookup:
        {
            description: "opening bracket (for array subscript)",
            tokenType: "openingBracket",

            processToken: function(token, state, context)
            {
                function listLookupOperator(listEvaluator, indexEvaluator)
                {
                    return function* listLookupEvaluator(variables)
                    {
                        let list = MychExpression.coerceList(yield* listEvaluator(variables));
                        let index = MychExpression.coerceNumber(yield* indexEvaluator(variables));

                        return (index >= 0) ? list[Math.floor(index)] : list[Math.floor(list.length - index)];
                    }
                }

                state.pushOperator(token, listLookupOperator, 0, { isIdempotent: true });
                state.startGroup(token);
            },

            nextRuleNames: new Set(
            [
                "unaryOperator",
                "debugOperator",
                "literal",
                "symbolLookup",
                "anonymousLookup",
                "openingParenthesis",
            ]),
            closeRuleNames: new Set(
            [
                "closingBracket",
            ]),
        },
        closingBracket:
        {
            description: "closing bracket",
            tokenType: "closingBracket",

            processToken: function(token, state, context)
            {
                state.reduceGroup(token);
            },

            nextRuleNames: new Set(
            [
                "binaryOperator",
                "propertyLookup",
                "closingParenthesis",
                "closingBracket",
                "endOfExpression",
            ]),
        },
        endOfExpression:
        {
            description: "end of expression",
            tokenType: "endOfExpression",
            nextRuleNames: new Set(),

            processToken: function(token, state, context)
            {
                state.reduceGroup(token);
            },
        },
    };

    static unaryOperatorDefs =
    {
        "+":
        {
            precedence: 2,
            evaluate: valueA => valueA,
        },
        "-":
        {
            precedence: 2,
            coerceValue: MychExpression.coerceNumber,
            evaluate: value => -value,
        },
        "not":
        {
            precedence: 8,
            coerceValue: MychExpression.coerceBoolean,
            evaluate: value => !value,
        },
    };

    static binaryOperatorDefs =
    {
        "**":
        {
            precedence: 1,
            rightAssociative: true,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA ** valueB,
        },
        "*":
        {
            precedence: 3,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA * valueB,
        },
        "/":
        {
            precedence: 3,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA / valueB,
        },
        "%":
        {
            precedence: 3,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => ((valueA % valueB) + valueB) % valueB,
        },
        "+":
        {
            precedence: 4,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA + valueB,
        },
        "-":
        {
            precedence: 4,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA - valueB,
        },
        "&":
        {
            precedence: 5,
            coerceValueA: MychExpression.coerceString,
            coerceValueB: MychExpression.coerceString,
            evaluate: (valueA, valueB) => valueA + valueB,
        },
        "<":
        {
            precedence: 6,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA < valueB,
        },
        "<=":
        {
            precedence: 6,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA <= valueB,
        },
        ">":
        {
            precedence: 6,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA > valueB,
        },
        ">=":
        {
            precedence: 6,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA >= valueB,
        },
        "==":
        {
            precedence: 7,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA == valueB,
        },
        "!=":
        {
            precedence: 7,
            coerceValueA: MychExpression.coerceNumber,
            coerceValueB: MychExpression.coerceNumber,
            evaluate: (valueA, valueB) => valueA != valueB,
        },
        "eq":
        {
            precedence: 7,
            coerceValueA: MychExpression.coerceString,
            coerceValueB: MychExpression.coerceString,
            evaluate: (valueA, valueB) => valueA == valueB,
        },
        "ne":
        {
            precedence: 7,
            coerceValueA: MychExpression.coerceString,
            coerceValueB: MychExpression.coerceString,
            evaluate: (valueA, valueB) => valueA != valueB,
        },
        "and":
        {
            precedence: 9,
            coerceValueA: MychExpression.coerceBoolean,
            coerceValueB: MychExpression.coerceBoolean,
            evaluate: (valueA, valueB) => valueA && valueB,
        },
        "or":
        {
            precedence: 10,
            coerceValueA: MychExpression.coerceBoolean,
            coerceValueB: MychExpression.coerceBoolean,
            evaluate: (valueA, valueB) => valueA || valueB,
        },
        "select":
        {
            precedence: 11,
            coerceValueA: MychExpression.coerceList,
            evaluate: function*(evaluatorA, evaluatorB)
            {
                return yield* MychExpression.mapList(yield* evaluatorA(),
                    function*(itemA) { return yield* evaluatorB(itemA) });
            }
        },
        "where":
        {
            precedence: 11,
            coerceValueA: MychExpression.coerceList,
            coerceValueB: MychExpression.coerceBoolean,
            evaluate: function*(evaluatorA, evaluatorB)
            {
                return yield* MychExpression.mapList(yield* evaluatorA(),
                    function*(itemA) { return (yield* evaluatorB(itemA)) ? itemA : undefined });
            }
        },
        ",":
        {
            precedence: 12,
            coerceValueA: MychExpression.coerceArgs,
            coerceValueB: MychExpression.coerceArgs,
            evaluate: (valueA, valueB) => valueA.concat(valueB),
        },
    };

    static createRuleNamesByTokenType()
    {
        let ruleNamesByTokenType = {};

        for (let [ruleName, rule] of Object.entries(MychExpression.rules))
        {
            let tokenTypes = rule.tokenType;

            for (let tokenType of Array.isArray(tokenTypes) ? tokenTypes : [tokenTypes])
            {
                ruleNamesByTokenType[tokenType] || (ruleNamesByTokenType[tokenType] = []);
                ruleNamesByTokenType[tokenType].push(ruleName);
            }
        }

        return ruleNamesByTokenType;
    }

    static ruleNamesByTokenType = MychExpression.createRuleNamesByTokenType();

    static createCloseRuleNames()
    {
        let closeRuleNames = new Set([ "endOfExpression" ]);

        for (let rule of Object.values(MychExpression.rules))
        {
            if (rule.closeRuleNames)
            {
                rule.closeRuleNames.forEach(closeRuleName => closeRuleNames.add(closeRuleName));
            }
        }

        return closeRuleNames;
    }

    static closeRuleNames = MychExpression.createCloseRuleNames();

    static minOperatorPrecedence = Math.min(
        ...Object.values(MychExpression.unaryOperatorDefs).map(operatorDef => operatorDef.precedence),
        ...Object.values(MychExpression.binaryOperatorDefs).map(operatorDef => operatorDef.precedence));

    static maxOperatorPrecedence = Math.max(
        ...Object.values(MychExpression.unaryOperatorDefs).map(operatorDef => operatorDef.precedence),
        ...Object.values(MychExpression.binaryOperatorDefs).map(operatorDef => operatorDef.precedence));

    static createPrecedenceIsRightAssociative()
    {
        let precedenceIsRightAssociative = [];

        for (let operatorDef of Object.values(MychExpression.binaryOperatorDefs))
        {
            let operatorPrecedence = operatorDef.precedence;
            let operatorIsRightAssociative = !!operatorDef.rightAssociative;

            if (precedenceIsRightAssociative[operatorPrecedence] == undefined)
            {
                precedenceIsRightAssociative[operatorPrecedence] = operatorIsRightAssociative;
            }
            else if (precedenceIsRightAssociative[operatorPrecedence] != operatorIsRightAssociative)
            {
                // associativity must be consistent on each precedence level to avoid ambiguities
                throw "MychExpression internal error: inconsistent associativity for precedence level " + operatorPrecedence;
            }
        }

        return precedenceIsRightAssociative;
    }

    static precedenceIsRightAssociative = MychExpression.createPrecedenceIsRightAssociative();

    static createTokenRegExp()
    {
        let operatorTokens = new Set([
            ...Object.keys(MychExpression.unaryOperatorDefs),
            ...Object.keys(MychExpression.binaryOperatorDefs)]);

        let operatorRegExpSource = [...operatorTokens].sort((tokenA, tokenB) => tokenB.length - tokenA.length).map(MychExpression.createTokenRegExpSource).join("|")

        let tokenPatterns =
        {
            unaryOrBinaryOperator:  operatorRegExpSource,

            literalNumber:          /(\.\d+|\d+(\.\d*)?)([eE][-+]?\d+)?/u,
            literalBooleanTrue:     MychExpression.createTokenRegExpSource("true"),
            literalBooleanFalse:    MychExpression.createTokenRegExpSource("false"),
            literalStringDouble:    /"([^"\\]|\\.)*"?/u,
            literalStringSingle:    /'([^'\\]|\\.)*'?/u,

            anonymousIdentifier:    /\.\.\./u,

            propertyOperator:       /\./u,
            debugOperator:          /\?{1,3}/u,

            identifier:             /(?<![\p{L}\p{N}_])[\p{L}_][\p{L}\p{N}_]*(?![\p{L}\p{N}_])|\$\[\[\w+\]\]/u,

            openingParenthesis:     /\(/u,
            closingParenthesis:     /\)/u,
            openingBracket:         /\[/u,
            closingBracket:         /\]/u,

            whitespace:             /\s+/u,
            unsupported:            /.+/u,
        }

        function createTokenRegExpSource([type, pattern])
        {
            return "(?<" + type + ">" + (pattern instanceof RegExp ? pattern.source : pattern) + ")";
        }

        return new RegExp(Object.entries(tokenPatterns).map(createTokenRegExpSource).join("|"), "ug");
    }

    static tokenRegExp = MychExpression.createTokenRegExp();

    static ParseState = class
    {
        evaluatorStack = [];
        operatorStack = [{ precedence: MychExpression.maxOperatorPrecedence + 1, operator: undefined, sourceOffset: 0 }];

        pushEvaluator(token, evaluator, attributes = {})
        {
            if (evaluator)
            {
                evaluator.sourceOffset = token.offset;
                evaluator.sourceLength = token.length;

                Object.assign(evaluator, attributes);
            }

            this.evaluatorStack.push(evaluator);
        }

        startGroup(token)
        {
            this.operatorStack.push({ operator: undefined, sourceOffset: token.offset, sourceLength: token.length });
        }

        reduceGroup(token)
        {
            let operatorEntry;
            let operatorEvaluator;

            while (this.operatorStack.length > 0)
            {
                operatorEntry = this.operatorStack.pop();

                if (!operatorEntry.operator)
                {
                    break;
                }

                operatorEvaluator = this.evaluateOperator(operatorEntry);
            }

            operatorEvaluator || (operatorEvaluator = this.evaluatorStack[this.evaluatorStack.length - 1]);

            if (operatorEvaluator)
            {
                operatorEvaluator.sourceOffset = operatorEntry.sourceOffset;
                operatorEvaluator.sourceLength = token.offset + token.length - operatorEvaluator.sourceOffset;
            }
        }

        pushOperator(token, operator, precedence, attributes = {})
        {
            if (operator.length > 1)
            {
                // keep same-precedence operators if precedence level is right-associative
                let stopPrecedence = MychExpression.precedenceIsRightAssociative[precedence] ? precedence : precedence + 0.5;

                let operatorEntry;
                let operatorEvaluator;

                while (this.operatorStack.length > 0)
                {
                    operatorEntry = this.operatorStack.pop();

                    if (!operatorEntry.operator || operatorEntry.precedence >= stopPrecedence)
                    {
                        this.operatorStack.push(operatorEntry);
                        break;
                    }

                    operatorEvaluator = this.evaluateOperator(operatorEntry);
                }
            }

            this.operatorStack.push({ precedence: precedence, operator: operator, sourceOffset: token.offset, sourceLength: token.length, ...attributes });
        }

        evaluateOperator(operatorEntry)
        {
            let numArgEvaluators = operatorEntry.operator.length;
            let argEvaluators = this.evaluatorStack.splice(-numArgEvaluators);

            let operatorEvaluator = operatorEntry.operator(...argEvaluators);

            operatorEvaluator.argEvaluators = argEvaluators;

            let definedArgEvaluators = argEvaluators.filter(evaluator => evaluator);

            operatorEvaluator.sourceOffset = Math.min(operatorEntry.sourceOffset, ...definedArgEvaluators.map(evaluator => evaluator.sourceOffset));
            operatorEvaluator.sourceLength = Math.max(operatorEntry.sourceOffset + operatorEntry.sourceLength, ...definedArgEvaluators.map(evaluator => evaluator.sourceOffset + evaluator.sourceLength)) - operatorEvaluator.sourceOffset;

            operatorEvaluator.isConstant = operatorEntry.isIdempotent && definedArgEvaluators.every(evaluator => evaluator.isConstant);

            this.evaluatorStack.push(operatorEvaluator);

            return operatorEvaluator;
        }

        processRule(context, ruleName, token)
        {
            let rule = MychExpression.rules[ruleName];
            rule.processToken(token, this, context);
        }
    }

    parse(source, context)
    {
        if (context == undefined)
        {
            throw "MychExpression internal error: no parse context";
        }

        this.source = source;
        this.context = context;
        this.tokens = [];

        let tokenMatch;

        MychExpression.tokenRegExp.lastIndex = 0;

        while (tokenMatch = MychExpression.tokenRegExp.exec(source))
        {
            if (tokenMatch.groups.whitespace)
            {
                continue;
            }

            if (tokenMatch.groups.unsupported)
            {
                throw new MychExpressionError("parse", "syntax error", source, tokenMatch.index);
            }

            let [tokenType, tokenValue] = Object.entries(tokenMatch.groups).find(([type, value]) => value);

            switch (tokenType)
            {
                case "unaryOrBinaryOperator":
                {
                    let isUnary = tokenValue in MychExpression.unaryOperatorDefs;
                    let isBinary = tokenValue in MychExpression.binaryOperatorDefs;

                    tokenType = (isUnary && isBinary) ? "unaryOrBinaryOperator" : isUnary ? "unaryOperator" : "binaryOperator";
                }
                break;

                case "literalNumber":
                {
                    tokenType = "literal";
                    tokenValue = parseFloat(tokenValue);
                }
                break;

                case "literalBooleanTrue":
                {
                    tokenType = "literal";
                    tokenValue = true;
                }
                break;

                case "literalBooleanFalse":
                {
                    tokenType = "literal";
                    tokenValue = false;
                }
                break;

                case "literalStringDouble":
                {
                    tokenType = "literal";
                    tokenValue = tokenValue.replace(/^"|"$/ug, "").replace(/\\(.)/ug, "$1");
                }
                break;

                case "literalStringSingle":
                {
                    tokenType = "literal";
                    tokenValue = tokenValue.replace(/^'|'$/ug, "").replace(/\\(.)/ug, "$1");
                }
                break;
            }

            let offset = tokenMatch.index;
            let length = tokenMatch[0].length;

            this.tokens.push({ type: tokenType, value: tokenValue, source: source, offset: offset, length: length });
        }

        this.tokens.push({ type: "endOfExpression", source: source, offset: source.length, length: 0 });

        let expectedNextRuleNames = MychExpression.rules.unaryOperator.nextRuleNames;
        let expectedCloseRuleNamesStack = [ new Set([ "endOfExpression" ]) ];

        function expectedRuleName(ruleName)
        {
            return expectedNextRuleNames.has(ruleName) && (!MychExpression.closeRuleNames.has(ruleName) || expectedCloseRuleNamesStack[0].has(ruleName));
        }

        for (let token of this.tokens)
        {
            token.ruleName = MychExpression.ruleNamesByTokenType[token.type].find(expectedRuleName);

            if (!token.ruleName)
            {
                let expectedRuleDescriptions = [...expectedNextRuleNames].filter(expectedRuleName).map(ruleName => MychExpression.rules[ruleName].description);  
                throw new MychExpressionError("parse", "expected " + expectedRuleDescriptions.join(", or "), source, token.offset);
            }

            if (MychExpression.closeRuleNames.has(token.ruleName))
            {
                expectedCloseRuleNamesStack.shift();
            }

            let rule = MychExpression.rules[token.ruleName];

            if (!rule)
            {
                let extraneousRuleDescription = MychExpression.rules[token.ruleName].description;
                throw new MychExpressionError("parse", "extraneous " + extraneousRuleDescription, source, token.offset);
            }

            if (rule.closeRuleNames)
            {
                expectedCloseRuleNamesStack.unshift(rule.closeRuleNames);
            }

            expectedNextRuleNames = rule.nextRuleNames;
        }

        if (expectedCloseRuleNamesStack.length > 0)
        {
            console.log("stack of expected close rules not empty:", expectedCloseRuleNamesStack);
            throw "MychExpression internal error: stack of expected close rules not empty";
        }

        let state = new MychExpression.ParseState();

        for (let token of this.tokens)
        {
            let rule = MychExpression.rules[token.ruleName];

            try
            {
                rule.processToken(token, state, context);
            }
            catch (exception)
            {
                throw new MychExpressionError("parse", exception.toString(), source, token.offset, exception);
            }
        }

        if (state.evaluatorStack.length != 1)
        {
            console.log("expression not reduced to exactly one evaluator:", this, state);
            throw "MychExpression internal error: expression not reduced to exactly one evaluator";
        }

        this.evaluator = state.evaluatorStack[0];
    }

    isConstant()
    {
        return this.evaluator && this.evaluator.isConstant;
    }

    evaluateConstant()
    {
        if (!this.evaluator)
        {
            throw new MychExpressionError("evaluate", "no expression parsed prior to evaluation", "", 0);
        }

        if (!this.evaluator.isConstant)
        {
            throw new MychExpressionError("evaluate", "expression is not parse-time constant", this.source, 0);
        }

        let resultContainer = this.evaluator(undefined).next();

        if (!resultContainer.done)
        {
            console.log("constant expression yields value prior to return:", this, resultContainer);
            throw "MychExpression internal error: constant expression yields value prior to return";
        }

        if (resultContainer.value instanceof MychExpressionArgs)
        {
            return MychExpression.coerceList(resultContainer.value);
        }

        return resultContainer.value;
    }

    *evaluate(variables)
    {
        if (!this.evaluator)
        {
            throw new MychExpressionError("evaluate", "no expression parsed prior to evaluation", "", 0);
        }

        let result = yield* this.evaluator(variables);

        if (result instanceof MychExpressionArgs)
        {
            return MychExpression.coerceList(result);
        }

        return result;
    }
}
