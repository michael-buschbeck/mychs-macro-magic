// Mych's Macro Magic by Michael Buschbeck <michael@buschbeck.net> (2021)
// https://github.com/michael-buschbeck/mychs-macro-magic/blob/main/LICENSE

const MMM_VERSION = "1.12.10";

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

        try
        {
            let scriptCommandTokens = scriptMatch.groups.command;

            let scriptMain = (player.script || new MychScript());
            let scriptAdded = scriptMain.addCommand(scriptCommandTokens, player.context);

            if (!player.script || (scriptAdded.type == "script" && !scriptAdded.complete))
            {
                player.script = scriptAdded;
                player.exception = undefined;
            }
        }
        catch (exception)
        {
            player.context.error(exception);
            player.exception = exception;
        }

        if (player.script && player.script.complete)
        {
            if (!player.exception)
            {
                let scriptVariables = new MychScriptVariables();

                if (player.script.type == "set")
                {
                    let variableName = player.script.definition.variable;
                    player.context.whisperback("\u26A0\uFE0F Value of **" + variableName + "** won't survive being **set** outside of a **script** block");
                }

                player.script.startExecute(scriptVariables);
            }

            player.script = undefined;
            player.exception = undefined;
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
            rollExpression = nameOrIdOrRollExpression;
        }
        else
        {
            nameOrId = nameOrIdOrRollExpression;
            rollExpression = rollExpressionIfNameOrId;
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
            return undefined;
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
            return undefined;
        }
    }

    literal(value)
    {
        return MychExpression.coerceString(value).replace(/[^\w\s]/g, char => "&#" + char.codePointAt(0) + ";")
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

        return (playerPage ? playerPage.get("scale_units") : undefined);
    }

    distscale()
    {
        let playerPageId = Campaign().get("playerpageid");
        let playerPage = getObj("page", playerPageId)

        if (!playerPage)
        {
            return undefined;
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
            return undefined;
        }

        let gridUnitsPerGridCell = playerPage.get("snapping_increment");
        let pixelsPerGridUnit = 70;
        let pixelsPerGridCell = pixelsPerGridUnit * gridUnitsPerGridCell;

        return pixelsPerGridCell;
    }

    getcharid(nameOrId)
    {
        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);
        return (character ? character.id : undefined);
    }

    static Denied = class
    {
        toScalar()
        {
            return undefined;
        }

        toMarkup()
        {
            return "<span style=\"background: red; border: 2px solid red; color: white; font-weight: bold\">denied</span>";
        }
    }

    isdenied(value)
    {
        return (value instanceof MychScriptContext.Denied);
    }

    findattr(nameOrId, table, selection)
    {
        const firstSelectionArgIndex = 2;

        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character || !this.$canControl(character))
        {
            return new MychScriptContext.Denied();
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

            return Object.values(tableNames).join(", ");
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

            return Object.values(colNames).join(", ");
        }

        let conditions = {};
        let conditionCount = 0;

        for (let argIndex = firstSelectionArgIndex; argIndex < arguments.length - 1; argIndex += 2)
        {
            let colName = MychExpression.coerceString(arguments[argIndex]);
            let colValue = MychExpression.coerceString(arguments[argIndex + 1]);

            conditions[colName.toLowerCase()] = colValue.toLowerCase();
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

            if (conditions[colName.toLowerCase()] == colValue.toLowerCase())
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

        return undefined;
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
            return undefined;
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
        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character && !token)
        {
            if (attributeName == "permission")
            {
                return "none";
            }

            return new MychScriptContext.Denied();
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

            case "rotation":
            {
                if (!max)
                {
                    lookupObj = token;
                    lookupKey = "rotation";
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
            return undefined;
        }

        if (!this.$canViewAttribute(lookupObj, attributeName))
        {
            return new MychScriptContext.Denied();
        }

        if (!lookupKey)
        {
            return undefined;
        }

        return lookupMod(lookupObj.get(lookupKey));
    }

    $setAttribute(nameOrId, attributeName, attributeValue, max = false)
    {
        let [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character && !token)
        {
            return new MychScriptContext.Denied();
        }

        let updateObj = undefined;
        let updateKey = undefined;
        let updateVal = undefined;

        switch (attributeName)
        {
            case "permission":
            {
                return new MychScriptContext.Denied();
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

            case "rotation":
            {
                if (!max)
                {
                    updateObj = token;
                    updateKey = "rotation";
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

                if (character && this.$canControlAttribute(character, attributeName))
                {
                    updateObj =
                        findObjs({ type: "attribute", characterid: character.id, name: attributeName }, { caseInsensitive: true })[0] ||
                        createObj("attribute", { characterid: character.id, name: attributeName });

                    updateKey = (max ? "max" : "current");
                    updateVal = MychExpression.coerceScalar(attributeValue);
                }
            }
            break;
        }
        
        if (!updateObj)
        {
            return undefined;
        }

        if (!updateKey || !this.$canControlAttribute(updateObj, attributeName))
        {
            return new MychScriptContext.Denied();
        }

        updateObj.set(updateKey, updateVal);

        return this.$getAttribute(nameOrId, attributeName, max);
    }

    $statusReset()
    {
        MychScriptContext.players = {};
        this.whisperback("All state reset.")
    }

    $statusDump()
    {
        let statusTableRows = [];

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
                let contextVariableMarkup = (contextVariableValue && contextVariableValue.toMarkup ? contextVariableValue.toMarkup() : this.literal(JSON.stringify(contextVariableValue)));
                contextDescription += "**" + this.literal(contextVariableName) + "** = " + contextVariableMarkup + "<br/>";
            }

            statusTableRows.push([ "Context", (contextDescription || "empty" )]);

            let scriptDescription;

            if (player.script)
            {
                function generateScriptSummary(script)
                {
                    if (script.complete)
                    {
                        return script.type || "uninitialized";
                    }
    
                    let nestedScriptSummaries = script.nestedScripts.map(nestedScript => generateScriptSummary(nestedScript));
                    return script.type + " [" + nestedScriptSummaries.join(", ") + "...]";
                }
    
                scriptDescription = generateScriptSummary(player.script);
            }

            statusTableRows.push([ "Script", this.literal(scriptDescription || "no script") ]);
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
}

class MychScriptVariables
{
    // generic container
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
            tokens: [ /(?<variable>\w+)/, "=", /(?<expression>.+)/ ],
            
            parse: function(args)
            {
                this.definition.variable = args.variable.value;

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
                    variables[this.definition.variable] = yield* this.definition.expression.evaluate(variables, this.context);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                }
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

                this.complete = true;
            },

            execute: function*(variables)
            {
                let message;

                if (this.definition.template)
                {
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
                let unescapedString = segmentMatch.groups.string.replace(/\\(.)/g, "$1");
                segments.push({ type: "string", offset: segmentOffset, value: unescapedString });
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

    *evaluate(variables, context)
    {
        let contextKeys = Object.keys(context).filter(key => /^(\W|\W.*\W)$/.test(key));
        let contextKeysRegExp;

        if (contextKeys.length > 0)
        {
            contextKeysRegExp = new RegExp(contextKeys.map(key => key.replace(/(\W)/g, "\\$1").replace(/^\b|\b$/, "\\b")).join("|"), "g");
        }

        let evaluatedSegments = [];

        for (let segment of this.segments)
        {
            switch (segment.type)
            {
                case "string":
                {
                    let evaluatedString = segment.value;

                    if (contextKeysRegExp)
                    {
                        evaluatedString = evaluatedString.replace(contextKeysRegExp,
                            function(key) { return MychExpression.coerceMarkup(context[key]) });
                    }

                    evaluatedSegments.push(evaluatedString);
                }
                break;

                case "expression":
                {
                    try
                    {
                        let expressionValue = yield* segment.expression.evaluate(variables, context);
                        evaluatedSegments.push(MychExpression.coerceMarkup(expressionValue));
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
    
        return evaluatedSegments.join("");
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
            binary: { precedence: 4, execute: (a,b) => MychExpression.coerceString(a) + MychExpression.coerceString(b) }
        },
        "<": {
            binary: { precedence: 5, execute: (a,b) => MychExpression.coerceNumber(a) < MychExpression.coerceNumber(b) }
        },
        "<=": {
            binary: { precedence: 5, execute: (a,b) => MychExpression.coerceNumber(a) <= MychExpression.coerceNumber(b) }
        },
        ">": {
            binary: { precedence: 5, execute: (a,b) => MychExpression.coerceNumber(a) > MychExpression.coerceNumber(b) }
        },
        ">=": {
            binary: { precedence: 5, execute: (a,b) => MychExpression.coerceNumber(a) >= MychExpression.coerceNumber(b) }
        },
        "==": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceNumber(a) == MychExpression.coerceNumber(b) }
        },
        "!=": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceNumber(a) != MychExpression.coerceNumber(b) }
        },
        "eq": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceString(a) == MychExpression.coerceString(b) }
        },
        "ne": {
            binary: { precedence: 6, execute: (a,b) => MychExpression.coerceString(a) != MychExpression.coerceString(b) }
        },
        "and": {
            binary: { precedence: 7, execute: (a,b) => MychExpression.coerceBoolean(a) && MychExpression.coerceBoolean(b) }
        },
        "or": {
            binary: { precedence: 8, execute: (a,b) => MychExpression.coerceBoolean(a) || MychExpression.coerceBoolean(b) }
        },
        "not": {
            unary:  { precedence: 9, execute: (a) => !MychExpression.coerceBoolean(a) },
        },
        ",": {
            binary: { precedence: 10, execute: (a,b) => MychExpression.coerceArgs(a).concat(MychExpression.coerceArgs(b)) }
        },
    };

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

            tokens.push({ type: tokenType, offset: tokenMatch.index, value: tokenValue });
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
                    executionArguments = executionArguments.flat(1);
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
        let expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: "opening" };

        function getExpectDescription()
        {
            return Object.entries(expectTokens).filter(([type, qualifier]) => qualifier).map(([type, qualifier]) => qualifier + " " + type).join(", ");
        }

        for (let token of this.tokens)
        {
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
                        expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: "opening" };
                    }
                    else
                    {
                        yield* reduce(operator.associativity == "right" ? operator.precedence - 1 : operator.precedence);

                        operationStack.push({ type: "operator", name: token.value, operands: 2, precedence: operator.precedence, execute: operator.execute });
                        expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: "opening" };
                    }
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
                        expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: ["opening", "closing"] };
                    }
                    else
                    {
                        yield* reduce();

                        let openingParenthesisOperation = operationStack.pop();
                        if (valueStack.length == openingParenthesisOperation.valueStackOffset)
                        {
                            valueStack.push([]);
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
