// Mych's Macro Magic by Michael Buschbeck <michael@buschbeck.net> (2021)
// https://github.com/michael-buschbeck/mychs-macro-magic/blob/main/LICENSE

const MMM_VERSION = "1.17.0-pre-1";

on("chat:message", function(msg)
{
    let msgContext = new MychScriptContext();
    let msgContextUpdated = false;
    
    if (msg.type == "rollresult")
    {
        msgContext.$consumeRolls([{ results: JSON.parse(msg.content), expression: msg.origRoll }]);
        msgContextUpdated = true;
    }
    else if (msg.inlinerolls && msg.inlinerolls.length > 0)
    {
        msgContext.$consumeRolls(msg.inlinerolls);
        msgContextUpdated = true;
    }

    let player = MychScriptContext.players[msg.playerid];

    if (!player)
    {
        player =
        {
            lastseen: undefined,
            context: new MychScriptContext(),
            script: undefined,
            customizations: undefined,
            exception: undefined,
        };

        MychScriptContext.players[msg.playerid] = player;
    }

    player.lastseen = new Date();

    if (msgContextUpdated)
    {
        player.context = msgContext;
    }

    player.context.sender = msg.who;
    player.context.playerid = msg.playerid;

    if (msg.type != "api")
    {
        return;
    }

    let statusSource = msg.content;

    let statusRegExp = /^(?<command>!mmm\s+status\s*)(?<arguments>.+)?$/;
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

    let msgContentLines = msg.content.split(/<br\/>\s+/);

    for (let msgContentLine of msgContentLines)
    {
        let scriptMatch = /^!mmm\b(\s*|\s(?<command>.+))$/.exec(msgContentLine);

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

                let scriptVariables = new MychScriptVariables();

                if (script.type == "set")
                {
                    let variableName = script.definition.variable;
                    player.context.whisperback("\u26A0\uFE0F Value of <strong>" + variableName + "</strong> won't survive being <strong>set</strong> outside of a <strong>script</strong> block");
                }

                script.startExecute(scriptVariables);
            }
        }
    }
});

class MychScriptContext
{
    static players = {};

    version = MMM_VERSION;
    playerid = undefined;
    sender = undefined;

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

    isdefault(value)
    {
        return (value instanceof MychScriptContext.Default);
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
        
            let tooltip = this.reason.replace(/"/g, "&quot;");
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

    isunknown(value)
    {
        return (value instanceof MychScriptContext.Unknown);
    }

    isdenied(value)
    {
        return (value instanceof MychScriptContext.Denied);
    }

    getreason(value)
    {
        if (value instanceof MychScriptContext.DiagnosticUndef)
        {
            return value.reason;
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
            let isRollCritical = context.iscritical(this);
            let isRollFumbled = context.isfumble(this);

            let highlightType = (isRollCritical && isRollFumbled) ? "important" : isRollCritical ? "good" : isRollFumbled ? "bad" : "normal";

            return context.highlight(this, highlightType, this.expression ? ("Rolling " + this.expression) : undefined).toMarkup();
        };

        return decoratedRoll;
    }

    $consumeRolls(rolls)
    {
        if (!rolls || rolls.length == 0)
        {
            return 0;
        }

        for (let rollIndex = 0; rollIndex < rolls.length; ++rollIndex)
        {
            let rollReference = "$[[" + rollIndex + "]]";
            this[rollReference] = this.$decorateRoll(rolls[rollIndex]);
        }

        return rolls.length;
    }

    *roll(nameOrIdOrRollExpression, rollExpressionIfNameOrId = undefined)
    {
        let nameOrId;
        let rollExpression;
        
        if (rollExpressionIfNameOrId == undefined)
        {
            nameOrId = this.sender;
            rollExpression = MychExpression.coerceString(nameOrIdOrRollExpression);
        }
        else
        {
            nameOrId = MychExpression.coerceString(nameOrIdOrRollExpression);
            rollExpression = MychExpression.coerceString(rollExpressionIfNameOrId);
        }

        if (rollExpression.match(/^\s*$/))
        {
            return new MychScriptContext.Unknown("Roll expression empty");
        }

        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        let characterContext = (character ? character.get("name") : this.sender);

        rollExpression = rollExpression.replace(/@\{([^}]+)\}/g, function(attributeCall, attributeExpression)
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

    highlight(value, type = "normal", tooltip = undefined)
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

        let borderStyleOverrides =
        {
            "good":      "2px solid #3FB315",
            "bad":       "2px solid #B31515",
            "important": "2px solid #4A57ED",
        };

        styles["border"] = borderStyleOverrides[MychExpression.coerceString(type)] || styles["border"];

        if (tooltip)
        {
            styles["cursor"] =  "help";
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

    chat(message)
    {
        let [character, token] = this.$getCharacterAndTokenObjs(this.sender);

        if (character)
        {
            sendChat("character|" + character.id, message);
            return;
        }
        
        if (this.playerid)
        {
            sendChat("player|" + this.playerid, message);
            return;
        }

        sendChat(this.sender || "Mych's Macro Magic", message);
    }

    whisperback(message)
    {
        let recipient = getObj("player", this.playerid).get("displayname");

        // remove all tokens from first double-quote on (since we can't escape double-quotes)
        recipient = recipient.replace(/\s*".*/, "");

        // enclose in double quotes, but only if there are actually spaces
        if (recipient.match(/\s/))
        {
            recipient = "\"" + recipient + "\"";
        }

        sendChat("Mych's Macro Magic", "/w " + recipient + " <br/>" + message, null, { noarchive: true });
    }

    error(exception)
    {
        log(exception.stack);
        this.whisperback(this.literal(exception));
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

            let attributeNameRegExp = /^repeating_(?<tableName>[^_]+)_/;
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

        let tableRegExpSource = MychExpression.coerceString(table).replace(/(\W)/g, "\\$1");

        let attributeNameRegExpSource = /^repeating_/.source + tableRegExpSource + /_(?<rowId>[-A-Za-z0-9]+)_(?<colName>\S+)$/.source;
        let attributeNameRegExp = new RegExp(attributeNameRegExpSource, "i");

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

        for (let [rowId, rowInfo] of Object.entries(rowInfos))
        {
            if (rowInfo.lookupAttributeName && rowInfo.conditionCount == conditionCount)
            {
                return rowInfo.lookupAttributeName;
            }
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

    $canControl(obj)
    {
        if (!this.playerid || !obj || !obj.get)
        {
            return false;
        }

        if (playerIsGM(this.playerid))
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

        let statusAttributeNameRegExp = /^status_(?<identifier>\w+)$/;
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
                let tokens = findObjs({ type: "graphic", subtype: "token", represents: characterOrToken.id, pageid: playerPageId });
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
                lookupObj = character ? (token || character) : undefined;
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
                let statusAttributeNameRegExp = /^status_(?<identifier>\w+)$/;
                let statusAttributeNameMatch = statusAttributeNameRegExp.exec(attributeName);
        
                if (statusAttributeNameMatch)
                {
                    if (!max)
                    {
                        let statusIdentifier = statusAttributeNameMatch.groups.identifier;

                        lookupObj = token;
                        lookupKey = "status_" + statusIdentifier.replace(/_/g, "-");
                        
                        // modify value to make both boolean and numeric interpretation simple:
                        // - false (hidden): false (as number: 0)
                        // - digit (shown with digit): string digit (as bool: true, number: digit)
                        // - other (shown undecorated): string "shown" (as bool: true, number: 0)
                        lookupMod = val => (val === false ? false : (str => str.match(/^[0-9]$/) ? str : "shown")(MychExpression.coerceString(val)));
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
                let statusAttributeNameRegExp = /^status_(?<identifier>\w+)$/;
                let statusAttributeNameMatch = statusAttributeNameRegExp.exec(attributeName);
        
                if (statusAttributeNameMatch)
                {
                    if (!max)
                    {
                        let statusIdentifier = statusAttributeNameMatch.groups.identifier;
                        
                        updateObj = token;
                        updateKey = "status_" + statusIdentifier.replace(/_/g, "-");

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
                            updateVal = (updateVal == "false" || updateVal == "" ? false : updateVal.match(/^[0-9]$/) ? updateVal : true);
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
        let highlightStart = "<span style='background: #E0E0E0; padding: 0em 0.3em; border: 2px solid silver; border-radius: 0.5em; color: black; white-space: pre-wrap'>";
        let highlightStop = "</span>";

        return highlightStart + this.literal(value) + highlightStop;
    }

    $debugCoerceMarkup(value)
    {
        if (value && value.toMarkup instanceof Function)
        {
            return value.toMarkup();
        }

        return this.$debugHighlight(MychExpression.literal(value));
    }

    $debugExpression(result, source, resultSourceBegin = 0, resultSourceEnd = source.length)
    {
        let markedSourceBefore = source.substring(0, resultSourceBegin);
        let markedSourceBetween = source.substring(resultSourceBegin, resultSourceEnd);
        let markedSourceAfter = source.substring(resultSourceEnd);

        let debugResult = this.$debugCoerceMarkup(result);
        let debugSource = this.literal(markedSourceBefore) + this.$debugHighlight(markedSourceBetween) + this.literal(markedSourceAfter);
        
        this.$debugMessage(debugResult + " \u25C0\uFE0F " + debugSource);
    }

    $debugMessage(message)
    {
        this.whisperback("\u{1F50E} " + message);
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
            }

            statusTableRows.push([ this.literal(playerDescription || playerId) ]);
            statusTableRows.push([ "Seen", player.lastseen.toISOString().replace(/T/, " ").replace(/Z$/, " UTC") ]);

            let contextDescription = "";

            for (let [contextVariableName, contextVariableValue] of Object.entries(player.context))
            {
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
        let sourceLines = source.split("\n").filter(line => !line.match(/^\s*$/)).map(line => "!mmm " + line);
        
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
            let destinationMacroSourceLines = destinationMacroSource.split("\n").filter(line => !line.match(/^\s*$/));
    
            let destinationMacroSourcePrefixLines = [];
            let destinationMacroSourceSuffixLines = [];
            let destinationMacroSourceLinesAreScript = destinationMacroSourceLines.map(line => !!line.match(/^!mmm\b/));
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

                let backupMacroSuffixRegExpSource = /^/.source + destination.replace(/(\W)/g, "\\$1") + /_backup_(?<suffix>\d+)$/.source;
                let backupMacroSuffixRegExp = new RegExp(backupMacroSuffixRegExpSource, "i");
                
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

class MychScriptVariables
{
    constructor()
    {
        this.$customizations = {};
    }

    integrateCustomizations(customizations)
    {
        for (let [key, value] of Object.entries(customizations))
        {
            if (key.match(/^\w+$/) || !(value instanceof Object))
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
        return "During " + this.stage + ", " + this.message + " in script: " + this.source.substring(0, this.offset) + "\u274C" + this.source.substring(this.offset);
    }
}

class MychScriptExit
{
    constructor(type)
    {
        this.type = type;
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
                exit:   [ /(?<type>\w+)/ ],
                exitif: [ /(?<type>\w+)/, "if", /(?<expression>.+)/ ],
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
                        this.definition.expression = new MychExpression(args.expression.value);
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
                        exitCondition = yield* this.definition.expression.evaluate(variables, this.context);
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
            tokens: [ /(?<expression>.+)/ ],

            parse: function(args)
            {
                let branch = { nestedScriptOffset: 0 };

                this.definition.branches = [branch];
                this.definition.branchElse = undefined;

                try
                {
                    this.definition.expressionOffset = args.expression.offset;
                    this.definition.expression = new MychExpression(args.expression.value);
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
                        branchCondition = yield* branchScript.definition.expression.evaluate(variables, this.context);
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
                elseif: [ "if", /(?<expression>.+)/ ],
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
                        this.definition.expression = new MychExpression(args.expression.value);
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

        set:
        {
            tokens:
            {
                assign:         [ /(?<variable>\w+)/, "=", /(?<expression>.+)/ ],
                customrequired: [ "customizable", /(?<customizable>)(?<variable>\w+)/ ],
                customdefault:  [ "customizable", /(?<customizable>)(?<variable>\w+)/, "=", /(?<expression>.+)/ ],
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
                        this.definition.expression = new MychExpression(args.expression.value);
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
                            variables[this.definition.variable] = customization;
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
                    variables[this.definition.variable] = yield* this.definition.expression.evaluate(variables, this.context);
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
                    if (this.definition.expression.tokens.length == 1 && this.definition.expression.tokens[0].type == "literal")
                    {
                        let onlyExpressionToken = this.definition.expression.tokens[0];
                        customizationCommand += " = " + MychExpression.literal(onlyExpressionToken.value);
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

        do:
        {
            tokens: [ /(?<expression>.+)/ ],

            parse: function(args)
            {
                try
                {
                    this.definition.expressionOffset = args.expression.offset;
                    this.definition.expression = new MychExpression(args.expression.value);
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
                    yield* this.definition.expression.evaluate(variables, this.context);
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
                template: [ ":", /(?<template>.+)/ ],
                custom:   [ "[", /(?<label>\w+)/, "]", ":", /(?<template>.+)/ ]
            },

            parse: function(args)
            {
                if (args.template)
                {
                    try
                    {
                        this.definition.templateOffset = args.template.offset;
                        this.definition.template = new MychTemplate(args.template.value);
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
                        message = yield* evaluateTemplate.evaluate(variables, this.context);
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

                let chatContext = (variables.chat ? variables : this.context);
                chatContext.chat(message);
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
                chatsep: [ "chat", "using", /(?<expression>.+)/ ],
            },

            parse: function(args)
            {
                if (args.expression)
                {
                    try
                    {
                        this.definition.expressionOffset = args.expression.offset;
                        this.definition.expression = new MychExpression(args.expression.value);
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
                        separator = yield* this.definition.expression.evaluate(variables, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                    }
                }

                let combineNestedScriptExit;

                let messages = [];
                let prevChat = variables.chat;

                try
                {
                    variables.chat = function(message)
                    {
                        messages.push(message);
                    };

                    combineNestedScriptExit = yield* this.executeNestedScripts(variables);
                }
                finally
                {
                    variables.chat = prevChat;
                }

                let chatContext = (variables.chat ? variables : this.context);
                chatContext.chat(messages.join(separator));

                return this.propagateExitOnReturn(combineNestedScriptExit);
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
                exportbackup:  [ "export", "to", /(?<destination>\w+)(?<backup>)/ ],
                exportreplace: [ "export", "to", /(?<destination>\w+)/, "without", "backup" ],
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

                    variables.integrateCustomizations(nestedVariables);

                    return this.propagateExitOnReturn(nestedScriptExit);
                }
            },
        },

        translate:
        {
            tokens: [ "[", /(?<label>\w+)/, "]", ":", /(?<template>.+)/ ],

            parse: function(args)
            {
                this.definition.label = args.label.value;

                try
                {
                    this.definition.templateOffset = args.template.offset;
                    this.definition.template = new MychTemplate(args.template.value);
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
                    translation = yield* this.definition.template.createMaterialized(variables, this.context);
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
                chat:      [ "chat", ":", /(?<template>.+)/ ],
                chatlabel: [ "chat", "[", /(?<label>\w+)/, "]", ":", /(?<template>.+)/],
                do:        [ "do", /(?<expression>.+)/ ],
            },

            parse: function(args)
            {
                if (args.template)
                {
                    try
                    {
                        this.definition.templateOffset = args.template.offset;
                        this.definition.template = new MychTemplate(args.template.value);
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
                        this.definition.expression = new MychExpression(args.expression.value);
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
                        message = yield* this.definition.template.evaluate(variables, this.context, value => this.context.$debugCoerceMarkup(value));
                    }
                    catch (exception)
                    {
                        this.rethrowTemplateError("execute", exception, this.definition.templateOffset);
                    }

                    this.context.$debugMessage(message);
                }

                if (this.definition.expression)
                {
                    let result;

                    try
                    {
                        result = yield* this.definition.expression.evaluate(variables, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                    }

                    this.context.$debugExpression(result, this.definition.expression.source);
                }
            },
        },
    };

    static parseTokens(tokenPatterns, source, sourceOffset)
    {
        let args = {};

        let whitespaceRegExp = /\s*/g;

        for (let tokenPattern of tokenPatterns)
        {
            whitespaceRegExp.lastIndex = sourceOffset;
            let whitespaceMatch = whitespaceRegExp.exec(source);

            if (!whitespaceMatch || whitespaceMatch.index != sourceOffset)
            {
                return [sourceOffset, undefined];
            }

            sourceOffset = whitespaceMatch.index + whitespaceMatch[0].length;

            let tokenRegExpSource;

            if (tokenPattern instanceof RegExp)
            {
                tokenRegExpSource = tokenPattern.source;
            }
            else
            {
                tokenRegExpSource = tokenPattern;
                tokenRegExpSource = tokenRegExpSource.replace(/(\W)/g, "\\$1");
                tokenRegExpSource = tokenRegExpSource.replace(/^\b|\b$/g, "\\b");
            }
            
            let tokenRegExp = new RegExp(tokenRegExpSource, "ig");

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
                let commandTokensAlternatives = (command.tokens instanceof Array ? [command.tokens] : Object.values(command.tokens));
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

            let [endSourceOffset, endCommandArgs] = MychScript.parseTokens([ "end", /(?<type>\w+)/ ], source, 0);

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
            if (exception instanceof MychScriptError)
            {
                exception.source = "!mmm " + exception.source;
                exception.offset += "!mmm ".length;
            }

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
    constructor(source)
    {
        this.source = undefined;
        this.segments = [];
        this.expressionSegments = {};

        if (source != undefined)
        {
            this.parse(source);
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

    parse(source)
    {
        let segments = [];
        let segmentRegExp = /(?<string>([^\\$]|\\.|\$(?!\{|\[\w))+)|\$(\[(?<exlabel>\w+)\])?\{(?<expression>([^}"']|"([^\\"]|\\.)*"|'([^\\']|\\.)*')*)\}|\$\[(?<reflabel>\w+)\]/g;
        let segmentMatch;

        let segmentOffset = 0;

        while (segmentMatch = segmentRegExp.exec(source))
        {
            if (segmentMatch.index != segmentOffset)
            {
                throw new MychTemplateError("parse", "syntax error", source, segmentOffset);
            }

            if (segmentMatch.groups.string)
            {
                let string = segmentMatch.groups.string.replace(/\\(.)/g, "$1");
                let stringSegment = { type: "string", value: string };

                segments.push(stringSegment);
            }

            if (segmentMatch.groups.expression)
            {
                let expressionLabel = segmentMatch.groups.exlabel;
                let expressionOffset = segmentOffset + "${".length + (expressionLabel ? ("[]".length + expressionLabel.length) : 0);

                try
                {
                    let expression = new MychExpression(segmentMatch.groups.expression);
                    let expressionSegment = { type: "expression", offset: expressionOffset, expression: expression, label: expressionLabel };

                    if (expressionLabel)
                    {
                        this.expressionSegments[expressionLabel] = expressionSegment;
                    }

                    segments.push(expressionSegment);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, expressionOffset);
                }
            }
            
            if (segmentMatch.groups.reflabel)
            {
                let referenceLabel = segmentMatch.groups.reflabel;
                let referenceSegment = { type: "reference", label: referenceLabel };
                
                segments.push(referenceSegment);
            }

            segmentOffset = segmentMatch.index + segmentMatch[0].length;
        }

        if (segmentOffset != source.length)
        {
            throw new MychTemplateError("parse", "syntax error", source, segmentOffset);
        }

        this.segments = segments;
    }

    getSourceWithReferences()
    {
        function reconstructSegment(segment)
        {
            if (segment.type == "string")
            {
                return segment.value.replace(/(\$[\{\[]|\\)/, "\\\\$1");
            }

            if (segment.type == "expression" && segment.label)
            {
                return "$[" + segment.label + "]";
            }

            return "...";
        }

        return this.segments.map(reconstructSegment).join("");
    }

    static createContextKeysRegExp(context)
    {
        let contextKeys = Object.keys(context).filter(key => /^(\W|\W.*\W)$/.test(key));

        if (contextKeys.length == 0)
        {
            return undefined;
        }

        return new RegExp(contextKeys.map(key => key.replace(/(\W)/g, "\\$1").replace(/^\b|\b$/, "\\b")).join("|"), "g");
    }

    static replaceContextKeys(string, contextKeysRegExp, context, markup)
    {
        if (!contextKeysRegExp)
        {
            return string;
        }

        return string.replace(contextKeysRegExp, key => markup(context[key]));
    }

    *evaluate(variables, context, markup = MychExpression.coerceMarkup)
    {
        let evaluatedStrings = [];

        let contextKeysRegExp = MychTemplate.createContextKeysRegExp(context);

        for (let segment of this.segments)
        {
            switch (segment.type)
            {
                case "string":
                {
                    let evaluatedString = MychTemplate.replaceContextKeys(segment.value, contextKeysRegExp, context, markup);
                    evaluatedStrings.push(evaluatedString);
                }
                break;

                case "expression":
                {
                    try
                    {
                        let evaluatedExpressionResult = yield* segment.expression.evaluate(variables, context);
                        evaluatedStrings.push(markup(evaluatedExpressionResult));
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
                    evaluatedStrings.push(evaluatedReference);
                }
                break;
            }
        }
    
        return evaluatedStrings.join("");
    }

    createTranslated(translationTemplate)
    {
        let translatedTemplate = new MychTemplate();

        translatedTemplate.source = this.source;
        translatedTemplate.expressionSegments = this.expressionSegments;
        translatedTemplate.segments = translationTemplate.segments.map(segment => (segment.type == "reference" ? this.expressionSegments[segment.label] : undefined) || segment);

        return translatedTemplate;
    }

    *createMaterialized(variables, context, markup = MychExpression.coerceMarkup)
    {
        let materializedTemplate = new MychTemplate();

        materializedTemplate.source = this.source;
        materializedTemplate.expressionSegments = {};

        let contextKeysRegExp = MychTemplate.createContextKeysRegExp(context);

        for (let segment of this.segments)
        {
            switch (segment.type)
            {
                case "string":
                {
                    let materializedString = MychTemplate.replaceContextKeys(segment.value, contextKeysRegExp, context, markup);
                    let materializedStringSegment = { type: "string", value: materializedString };

                    materializedTemplate.segments.push(materializedStringSegment);
                }
                break;

                case "expression":
                {
                    try
                    {
                        let materializedExpressionResult = yield* segment.expression.evaluate(variables, context);
                        let materializedExpressionSegment = { type: "string", value: markup(materializedExpressionResult) };

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
    constructor(source)
    {
        this.source = undefined;
        this.tokens = [];
    
        if (source != undefined)
        {
            this.parse(source);
        }
    }

    static coerceScalar(value)
    {
        if (value instanceof Array)
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

        return MychExpression.coerceString(value);
    }

    static coerceString(value)
    {
        if (value instanceof Array)
        {
            return value.map(MychExpression.coerceString).join(", ");
        }

        value = MychExpression.coerceScalar(value);

        if (value == undefined || value == null)
        {
            return "";
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

    static literal(value)
    {
        if (value instanceof Array)
        {
            return value.map(MychExpression.literal).join(", ");
        }

        value = MychExpression.coerceScalar(value);

        switch (typeof(value))
        {
            case "string":
            {
                let stringLiteral = "\"" + value.replace(/(["\\])/g, "\\$1") + "\"";
                return stringLiteral;
            }

            case "undefined":
            {
                return "undef";
            }
        }

        return String(value);
    }

    static operators =
    {
        "**": {
            binary: { precedence: 1, execute: (a,b) => MychExpression.coerceNumber(a) ** MychExpression.coerceNumber(b), associativity: "right" }
        },
        "*": {
            binary: { precedence: 3, execute: (a,b) => MychExpression.coerceNumber(a) * MychExpression.coerceNumber(b) }
        },
        "/": {
            binary: { precedence: 3, execute: (a,b) => MychExpression.coerceNumber(a) / MychExpression.coerceNumber(b) }
        },
        "%": {
            binary: { precedence: 3, execute: (a,b) => ((an,bn) => ((an % bn) + bn) % bn)(MychExpression.coerceNumber(a), MychExpression.coerceNumber(b)) }
        },
        "+": {
            unary:  { precedence: 2, execute: (a) => a },
            binary: { precedence: 4, execute: (a,b) => MychExpression.coerceNumber(a) + MychExpression.coerceNumber(b) }
        },
        "-": {
            unary:  { precedence: 2, execute: (a) => -MychExpression.coerceNumber(a) },
            binary: { precedence: 4, execute: (a,b) => MychExpression.coerceNumber(a) - MychExpression.coerceNumber(b) }
        },
        "&": {
            binary: { precedence: 5, execute: (a,b) => MychExpression.coerceString(a) + MychExpression.coerceString(b) }
        },
        "<": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceNumber(a) < MychExpression.coerceNumber(b) }
        },
        "<=": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceNumber(a) <= MychExpression.coerceNumber(b) }
        },
        ">": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceNumber(a) > MychExpression.coerceNumber(b) }
        },
        ">=": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceNumber(a) >= MychExpression.coerceNumber(b) }
        },
        "==": {
            binary: { precedence: 7, execute: (a,b) => MychExpression.coerceNumber(a) == MychExpression.coerceNumber(b) }
        },
        "!=": {
            binary: { precedence: 7, execute: (a,b) => MychExpression.coerceNumber(a) != MychExpression.coerceNumber(b) }
        },
        "eq": {
            binary: { precedence: 7, execute: (a,b) => MychExpression.coerceString(a) == MychExpression.coerceString(b) }
        },
        "ne": {
            binary: { precedence: 7, execute: (a,b) => MychExpression.coerceString(a) != MychExpression.coerceString(b) }
        },
        "not": {
            unary:  { precedence: 8, execute: (a) => !MychExpression.coerceBoolean(a) },
        },
        "and": {
            binary: { precedence: 9, execute: (a,b) => MychExpression.coerceBoolean(a) && MychExpression.coerceBoolean(b) }
        },
        "or": {
            binary: { precedence: 10, execute: (a,b) => MychExpression.coerceBoolean(a) || MychExpression.coerceBoolean(b) }
        },
        ",": {
            binary: { precedence: 11, execute: (a,b) => MychExpression.coerceArgs(a).concat(MychExpression.coerceArgs(b)) }
        },
    };

    static minOperatorPrecedence = Math.min(...Object.values(MychExpression.operators).map(variants => Object.values(variants).map(variant => variant.precedence)).flat());
    static maxOperatorPrecedence = Math.max(...Object.values(MychExpression.operators).map(variants => Object.values(variants).map(variant => variant.precedence)).flat());

    static createTokenRegExp()
    {
        function compareLengthDecreasing(string1, string2)
        {
            // Sort in decreasing order of string length.
            return (string2.length - string1.length);
        }

        function createOperatorRegExpSource(operator)
        {
            // Escape all characters that might have special meaning and add boundary assertions.
            return operator.replace(/(\W)/g, "\\$1").replace(/^\b|\b$/g, "\\b");
        }

        let operatorRegExpSource = Object.keys(MychExpression.operators).sort(compareLengthDecreasing).map(createOperatorRegExpSource).join("|");

        let tokenPatterns =
        {
            operator:             operatorRegExpSource,
            debug:                /\?{1,3}/,
            literalNumber:        /(\.\d+|\d+(\.\d*)?)([eE][-+]?\d+)?/,
            literalBoolean:       /\b(true|false)\b/,
            literalStringDouble:  /"([^"\\]|\\.)*"?/,
            literalStringSingle:  /'([^'\\]|\\.)*'?/,
            identifier:           /\b\w+\b|\$\[\[\w+\]\]/,
            parenthesis:          /[()]/,
            whitespace:           /\s+/,
            unsupported:          /.+/,
        }

        function createTokenRegExpSource([type, pattern])
        {
            if (pattern instanceof RegExp)
            {
                pattern = pattern.source;
            }

            return "(?<" + type + ">" + pattern + ")";
        }

        return new RegExp(Object.entries(tokenPatterns).map(createTokenRegExpSource).join("|"), "g");
    }

    static tokenRegExp = MychExpression.createTokenRegExp();

    parse(source)
    {
        let tokens = [];
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
                case "literalNumber":
                {
                    tokenType = "literal";
                    tokenValue = parseFloat(tokenValue);
                }
                break;

                case "literalBoolean":
                {
                    tokenType = "literal";
                    tokenValue = (tokenValue == "true");
                }
                break;

                case "literalStringDouble":
                {
                    tokenType = "literal";
                    tokenValue = tokenValue.replace(/^"|"$/g, "").replace(/\\(.)/g, "$1");
                }
                break;

                case "literalStringSingle":
                {
                    tokenType = "literal";
                    tokenValue = tokenValue.replace(/^'|'$/g, "").replace(/\\(.)/g, "$1");
                }
                break;
            }

            let offset = tokenMatch.index;
            let offsetEnd = tokenMatch.index + tokenMatch[0].length;

            tokens.push({ type: tokenType, offset: offset, offsetEnd: offsetEnd, value: tokenValue });
        }

        this.source = source;
        this.tokens = tokens;
    }

    *evaluate(variables, context)
    {
        let valueStack = [];
        let operationStack = [];

        function* reduce(precedence)
        {
            while (operationStack.length > 0)
            {
                let operation = operationStack[operationStack.length - 1];

                if (operation.type == "parenthesis")
                {
                    break;
                }

                if (precedence != undefined && operation.precedence > precedence)
                {
                    break;
                }

                operationStack.pop();

                let executionArguments = valueStack.splice(-operation.operands);
                let executionResult;

                if (operation.type == "function")
                {
                    executionArguments = executionArguments.flatMap(arg => arg instanceof MychExpressionArgs ? arg : [arg]);
                    executionResult = operation.execute.apply(operation.context, executionArguments);

                    if (executionResult && executionResult.next)
                    {
                        executionResult = yield* executionResult;
                    }
                }
                else
                {
                    executionResult = operation.execute.apply(this, executionArguments);
                }

                valueStack.push(executionResult);
            }
        }

        let expectClosing = [{}];
        let expectTokens = { operator: "unary", debug: "any", literal: "any", identifier: "any", parenthesis: "opening" };

        function getExpectDescription()
        {
            return Object.entries(expectTokens).filter(([type, qualifier]) => qualifier).map(([type, qualifier]) => qualifier + " " + type).join(", ");
        }

        let maxEvaluatedTokenIndex;

        for (let tokenIndex = 0; tokenIndex < this.tokens.length; ++tokenIndex)
        {
            let token = this.tokens[tokenIndex];

            let tokenQualifier = "any";
            let expectTokenQualifiers = [expectTokens[token.type]].flat();

            let operator = undefined;

            switch (token.type)
            {
                case "operator":
                {
                    let operatorVariants = MychExpression.operators[token.value];
                    let operatorType = expectTokenQualifiers.find(qualifier => operatorVariants[qualifier]);
                    operator = operatorVariants[operatorType];
                    tokenQualifier = operatorType || Object.keys(operatorVariants).join("/");
                }
                break;

                case "parenthesis":
                {
                    tokenQualifier = (token.value == "(" ? "opening" : "closing");
                }
                break;
            }

            if (!expectTokenQualifiers.includes(tokenQualifier))
            {
                let expectDescription = getExpectDescription();
                throw new MychExpressionError("evaluate", tokenQualifier + " " + token.type + " not expected here (expected " + expectDescription + ")", this.source, token.offset);
            }

            switch (token.type)
            {
                case "operator":
                {
                    if (tokenQualifier == "unary")
                    {
                        operationStack.push({ type: "operator", name: token.value, operands: 1, precedence: operator.precedence, execute: operator.execute });
                        expectTokens = { operator: "unary", debug: "any", literal: "any", identifier: "any", parenthesis: "opening" };
                    }
                    else
                    {
                        maxEvaluatedTokenIndex = tokenIndex - 1;

                        yield* reduce(operator.associativity == "right" ? operator.precedence - 1 : operator.precedence);

                        operationStack.push({ type: "operator", name: token.value, operands: 2, precedence: operator.precedence, execute: operator.execute });
                        expectTokens = { operator: "unary", debug: "any", literal: "any", identifier: "any", parenthesis: "opening" };
                    }
                }
                break;

                case "debug":
                {
                    let debugExpression = this;
                    let debugTokenIndex = tokenIndex;

                    function debug(value)
                    {
                        let sourceBegin = debugExpression.tokens[debugTokenIndex].offset;
                        let sourceEnd = debugExpression.tokens[maxEvaluatedTokenIndex].offsetEnd;

                        context.$debugExpression(value, debugExpression.source, sourceBegin, sourceEnd);
                    
                        return value;
                    }

                    let debugPrecedence;

                    switch (token.value.length)
                    {
                        case 1: debugPrecedence = MychExpression.minOperatorPrecedence - 1; break;
                        case 2: debugPrecedence = MychExpression.operators["<"].binary.precedence - 1; break;
                        case 3: debugPrecedence = MychExpression.maxOperatorPrecedence + 1; break;
                    }

                    let prevOperation = operationStack[operationStack.length - 1];
                    let maxDebugPrecedence = (prevOperation ? prevOperation.precedence : MychExpression.maxOperatorPrecedence + 1);

                    operationStack.push({ type: "debug", name: token.value, operands: 1, precedence: Math.min(debugPrecedence, maxDebugPrecedence), execute: debug });
                    expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: "opening" };
                }
                break;

                case "literal":
                {
                    valueStack.push(token.value);
                    expectTokens = { operator: "binary", parenthesis: expectClosing[0].parenthesis };
                }
                break;

                case "identifier":
                {
                    let identifierContext = variables;
                    let identifierValue = variables[token.value];

                    if (identifierValue == undefined)
                    {
                        identifierContext = context;
                        identifierValue = context[token.value];
                    }

                    if (identifierValue instanceof Function)
                    {
                        operationStack.push({ type: "function", name: token.value, operands: 1, precedence: 0, execute: identifierValue, context: identifierContext });
                        expectTokens = { parenthesis: "opening" };
                    }
                    else
                    {
                        valueStack.push(identifierValue);
                        expectTokens = { operator: "binary", parenthesis: expectClosing[0].parenthesis };
                    }
                }
                break;

                case "parenthesis":
                {
                    if (token.value == "(")
                    {
                        operationStack.push({ type: "parenthesis", valueStackOffset: valueStack.length });
                        expectClosing.unshift({ parenthesis: "closing" });
                        expectTokens = { operator: "unary", debug: "any", literal: "any", identifier: "any", parenthesis: ["opening", "closing"] };
                    }
                    else
                    {
                        maxEvaluatedTokenIndex = tokenIndex - 1;

                        yield* reduce();

                        let openingParenthesisOperation = operationStack.pop();
                        if (valueStack.length == openingParenthesisOperation.valueStackOffset)
                        {
                            valueStack.push(MychExpressionArgs.of());
                        }

                        expectClosing.shift();
                        expectTokens = { operator: "binary", parenthesis: expectClosing[0].parenthesis };
                    }
                }
                break;
            }
        }

        if (expectTokens.operator != "binary")
        {
            let expectDescription = getExpectDescription();
            throw new MychExpressionError("evaluate", "expected " + expectDescription, this.source, this.source.length);
        }

        maxEvaluatedTokenIndex = this.tokens.length - 1;

        yield* reduce();

        if (operationStack.length != 0)
        {
            let expectDescription = getExpectDescription();
            throw new MychExpressionError("evaluate", "expected " + expectDescription, this.source, this.source.length);
        }

        let result = MychExpression.coerceScalar(valueStack);

        if (result instanceof MychExpressionArgs)
        {
            result = Array.of.apply(null, result);
        }

        return result;
    }
}
