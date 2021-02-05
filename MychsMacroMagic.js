// Mych's Macro Magic by Michael Buschbeck <michael@buschbeck.net> (2021)
// https://github.com/michael-buschbeck/mychs-macro-magic/blob/main/LICENSE

const MMM_VERSION = "1.7.0";

on("chat:message", function(msg)
{
    var msgContext = new MychScriptContext();
    var msgContextUpdated = false;
    
    if (msg.type == "rollresult")
    {
        var msgRollResults = JSON.parse(msg.content);
        msgContextUpdated = (msgContext.$consumeRolls([{ results: msgRollResults, expression: msg.origRoll }]) > 0);
    }
    else
    {
        msgContextUpdated = (msgContext.$consumeRolls(msg.inlinerolls) > 0);
    }

    var player = MychScriptContext.players[msg.playerid];

    if (!player)
    {
        player =
        {
            context: new MychScriptContext(),
            script: undefined,
            exception: undefined,
        };

        MychScriptContext.players[msg.playerid] = player;
    }

    if (msgContextUpdated)
    {
        player.context = msgContext;
    }

    player.context.sender = msg.who;
    player.context.playerid = msg.playerid;

    var scriptMatch = /^!mmm\b(\s*|\s(?<command>.+))$/.exec(msg.content);

    if (msg.type != "api" || !scriptMatch || !scriptMatch.groups.command)
    {
        return;
    }

    if (!player.script)
    {
        player.script = new MychScript(new MychScriptVariables());
    }

    try
    {
        var scriptCommand = scriptMatch.groups.command;
        var scriptAdded = player.script.addCommand(scriptCommand, player.context);

        if (scriptAdded.type == "script")
        {
            player.script = scriptAdded;
        }
    }
    catch (exception)
    {
        player.context.error(exception);
        player.exception = exception;
    }

    if (player.script.complete)
    {
        if (!player.exception)
        {
            player.script.startExecute();
        }

        player.script = undefined;
        player.exception = undefined;
    }
});

class MychScriptContext
{
    static players = {};

    version = MMM_VERSION;
    playerid = undefined;
    sender = undefined;

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
        var minValue = undefined;

        for (var argIndex = 0; argIndex < arguments.length; ++argIndex)
        {
            var argValue = arguments[argIndex];
            
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
        var maxValue = undefined;

        for (var argIndex = 0; argIndex < arguments.length; ++argIndex)
        {
            var argValue = arguments[argIndex];
            
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

    $decorateRoll(roll)
    {
        var context = this;

        var decoratedRoll = Object.create(roll);
            
        decoratedRoll.toScalar = function()
        {
            return this.results.total;
        };

        decoratedRoll.toMarkup = function()
        {
            var isRollCritical = context.iscritical(this);
            var isRollFumbled = context.isfumble(this);

            var highlightType = (isRollCritical && isRollFumbled) ? "important" : isRollCritical ? "good" : isRollFumbled ? "bad" : "normal";

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

        for (var rollIndex = 0; rollIndex < rolls.length; ++rollIndex)
        {
            var rollReference = "$[[" + rollIndex + "]]";
            this[rollReference] = this.$decorateRoll(rolls[rollIndex]);
        }

        return rolls.length;
    }

    *roll(rollExpression)
    {
        var context = this;

        var rollResult = yield MychScript.continueExecuteOnCallback(function(rollResultCallback)
        {
            var sendChatCallback = function(msgs)
            {
                var rollResultsMsg = msgs.filter(msg => msg.type == "rollresult")[0];
                
                if (!rollResultsMsg)
                {
                    console.log("No roll result found in sendChat() results:", msgs);
                    return;
                }

                var rollResults = JSON.parse(rollResultsMsg.content);
                rollResultCallback(context.$decorateRoll({ results: rollResults, expression: rollResultsMsg.origRoll }));
            };

            sendChat(context.sender || "Mych's Macro Magic", "/roll " + MychExpression.coerceString(rollExpression), sendChatCallback, {use3d: true});
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
        var replacements =
        {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&apos;",
        };

        return MychExpression.coerceString(value).replace(/[&<>"']/g, char => replacements[char]);
    }

    highlight(value, type = "normal", tooltip = undefined)
    {
        var result;
        
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

        var styles =
        {
            "padding": "0 3px 0 3px",
            "color": "black",
            "background-color": "#FEF68E",
            "border": "2px solid #FEF68E",
            "font-weight": "bold",
            "font-size": "1.1em",
        };

        var borderStyleOverrides =
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

        var valueLiteral = this.literal(value);
        var styleLiteral = this.literal(Object.entries(styles).map(styleEntry => styleEntry.join(":")).join(";"));

        if (!tooltip)
        {
            var classLiteral = this.literal("mmm-highlight mmm-highlight-" + type);

            result.toMarkup = function()
            {
                return "<span class=\"" + classLiteral + "\" style=\"" + styleLiteral + "\">" + valueLiteral + "</span>";
            }
        }
        else
        {
            var titleLiteral = this.literal(tooltip);
            var classLiteral = this.literal("mmm-highlight mmm-highlight-" + type + " showtip tipsy-n-right");

            result.toMarkup = function()
            {
                return "<span class=\"" + classLiteral + "\" title=\"" + titleLiteral + "\" style=\"" + styleLiteral + "\">" + valueLiteral + "</span>";
            };
        }

        return result;
    }

    chat(message)
    {
        var [character, token] = this.$getCharacterAndTokenObjs(this.sender);

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

    error(exception)
    {
        log(exception.stack);
        sendChat("Mych's Macro Magic", "/direct " + exception, null, { noarchive: true });
    }

    distunits()
    {
        var playerPageId = Campaign().get("playerpageid");
        var playerPage = getObj("page", playerPageId)

        return (playerPage ? playerPage.get("scale_units") : undefined);
    }

    distscale()
    {
        var playerPageId = Campaign().get("playerpageid");
        var playerPage = getObj("page", playerPageId)

        if (!playerPage)
        {
            return undefined;
        }

        var gridUnitsPerGridCell = playerPage.get("snapping_increment");
        var pixelsPerGridUnit = 70;
        var pixelsPerGridCell = pixelsPerGridUnit * (gridUnitsPerGridCell || 1);
        var measurementUnitsPerGridCell = playerPage.get("scale_number");
        var measurementUnitsPerPixel = measurementUnitsPerGridCell / pixelsPerGridCell;

        return measurementUnitsPerPixel;
    }

    distsnap()
    {
        var playerPageId = Campaign().get("playerpageid");
        var playerPage = getObj("page", playerPageId)

        if (!playerPage)
        {
            return undefined;
        }

        var gridUnitsPerGridCell = playerPage.get("snapping_increment");
        var pixelsPerGridUnit = 70;
        var pixelsPerGridCell = pixelsPerGridUnit * gridUnitsPerGridCell;

        return pixelsPerGridCell;
    }

    getcharid(nameOrId)
    {
        var [character, token] = this.$getCharacterAndTokenObjs(nameOrId);
        return (character ? character.id : undefined);
    }

    findattr(nameOrId, table, selection)
    {
        const firstSelectionArgIndex = 2;

        var [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character || !this.$canControl(character))
        {
            return this.$getDenied();
        }

        if (arguments.length == 1)
        {
            var tableNames = {};

            var attributeNameRegExp = /^repeating_(?<tableName>[^_]+)_/;
            var attributes = findObjs({ type: "attribute", characterid: character.id });

            for (var attribute of attributes)
            {
                var attributeName = attribute.get("name");
                var attributeNameMatch = attributeNameRegExp.exec(attributeName);
    
                if (!attributeNameMatch || !this.$canViewAttribute(character, attributeName))
                {
                    continue;
                }

                var tableName = attributeNameMatch.groups.tableName;

                tableNames[tableName.toLowerCase()] = tableName;
            }

            return Object.values(tableNames).join(", ");
        }

        var tableRegExpSource = MychExpression.coerceString(table).replace(/(\W)/g, "\\$1");

        var attributeNameRegExpSource = /^repeating_/.source + tableRegExpSource + /_(?<rowId>[-A-Za-z0-9]+)_(?<colName>\S+)$/.source;
        var attributeNameRegExp = new RegExp(attributeNameRegExpSource, "i");

        if (arguments.length == 2)
        {
            var colNames = {};

            var attributes = findObjs({ type: "attribute", characterid: character.id });

            for (var attribute of attributes)
            {
                var attributeName = attribute.get("name");
                var attributeNameMatch = attributeNameRegExp.exec(attributeName);
    
                if (!attributeNameMatch || !this.$canViewAttribute(character, attributeName))
                {
                    continue;
                }
                
                var colName = attributeNameMatch.groups.colName;

                colNames[colName.toLowerCase()] = colName;
            }

            return Object.values(colNames).join(", ");
        }

        var conditions = {};
        var conditionCount = 0;

        for (var argIndex = firstSelectionArgIndex; argIndex < arguments.length - 1; argIndex += 2)
        {
            var colName = MychExpression.coerceString(arguments[argIndex]);
            var colValue = MychExpression.coerceString(arguments[argIndex + 1]);

            conditions[colName.toLowerCase()] = colValue.toLowerCase();
            conditionCount += 1;
        }

        var rowInfos = {}

        var lookupColName = ((arguments.length - firstSelectionArgIndex) % 2 == 0
            ? arguments[arguments.length - 2]
            : arguments[arguments.length - 1]); 

        var attributes = findObjs({ type: "attribute", characterid: character.id });

        for (var attribute of attributes)
        {
            var attributeName = attribute.get("name");
            var attributeNameMatch = attributeNameRegExp.exec(attributeName);

            if (!attributeNameMatch || !this.$canViewAttribute(character, attributeName))
            {
                continue;
            }

            var rowId = attributeNameMatch.groups.rowId;
            var colName = attributeNameMatch.groups.colName;
            var colValue = MychExpression.coerceString(attribute.get("current"));

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

        for (var [rowId, rowInfo] of Object.entries(rowInfos))
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

        var objType = obj.get("type");

        if (objType == "attribute")
        {
            var ownerCharacterId = obj.get("characterid");
            var ownerCharacter = getObj("character", ownerCharacterId);
            return this.$canControl(ownerCharacter);
        }

        if (objType == "hand" && obj.get("parentid") == this.playerid)
        {
            return true;
        }

        // objType == "graphic"
        var representsCharacterId = obj.get("represents");

        if (representsCharacterId)
        {
            var representsCharacter = getObj("character", representsCharacterId);
            return this.$canControl(representsCharacter);
        }

        // objType == "path", "text", "graphic", "character"
        var controllerPlayerIds = obj.get("controlledby");

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

        var objType = obj.get("type");

        if (objType == "attribute")
        {
            var characterId = obj.get("characterid");
            return this.$canView(getObj("character", characterId));
        }

        var playerPageId = Campaign().get("playerpageid");

        if (objType == "page" && obj.id == playerPageId)
        {
            return true;
        }

        // objType == "character", "handout"
        var journalPlayerIds = obj.get("inplayerjournals");

        if (journalPlayerIds && journalPlayerIds.split(",").some(id => id == "all" || id == this.playerid))
        {
            return true;
        }

        // objType == "text", "path", "graphic"
        var drawingPageId = obj.get("pageid");

        if (drawingPageId && drawingPageId == playerPageId)
        {
            var drawingLayer = obj.get("layer");
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
                var character = this.$getCorrespondingCharacterObj(obj);
                var token = this.$getCorrespondingTokenObj(obj);
                return (this.$canView(character) || (this.$canView(token) && token.get("showplayers_name")));
            }

            case "bar1":
            case "bar2":
            case "bar3":
            {
                var token = this.$getCorrespondingTokenObj(obj);
                return (this.$canView(token) && token.get("showplayers_" + attributeName));
            }

            case "left":
            case "top":
            {
                return this.$canView(obj);
            }
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
                var playerPageId = Campaign().get("playerpageid");
                var tokens = findObjs({ type: "graphic", subtype: "token", represents: characterOrToken.id, pageid: playerPageId });
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
                var character = getObj("character", characterOrToken.get("represents"));
                return character;
            }
        }

        return undefined;
    }    

    $getCharacterAndTokenObjs(nameOrId)
    {
        var characterOrToken =
            getObj("character", nameOrId) ||
            getObj("graphic", nameOrId);

        if (!this.$canView(characterOrToken))
        {
            characterOrToken = undefined;
        }

        if (!characterOrToken)
        {
            characterOrToken =
                findObjs({ type: "character", name: nameOrId }).filter(obj => this.$canViewAttribute(obj, "name"))[0] ||
                findObjs({ type: "graphic", name: nameOrId }).filter(obj => this.$canViewAttribute(obj, "name"))[0];
        }

        if (!characterOrToken)
        {
            return [undefined, undefined];
        }

        var character = undefined;
        var token = undefined;

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

    $getDenied()
    {
        var denied =
        {
            toScalar: () => undefined,
            toMarkup: () => "<span style=\"background: red; border: 2px solid red; color: white; font-weight: bold\">denied</span>",
        };

        return denied;
    }

    $getAttribute(nameOrId, attributeName, max = false)
    {
        var [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character && !token)
        {
            if (attributeName == "permission")
            {
                return "none";
            }

            return this.$getDenied();
        }

        var lookupObj = undefined;
        var lookupKey = undefined;
        var lookupMod = val => val;

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

            default:
            {
                if (character)
                {
                    lookupObj = findObjs({ type: "attribute", characterid: character.id, name: attributeName })[0];
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
            return this.$getDenied();
        }

        if (!lookupKey)
        {
            return undefined;
        }

        return lookupMod(lookupObj.get(lookupKey));
    }

    $setAttribute(nameOrId, attributeName, attributeValue, max = false)
    {
        var [character, token] = this.$getCharacterAndTokenObjs(nameOrId);

        if (!character && !token)
        {
            return this.$getDenied();
        }

        var updateObj = undefined;
        var updateKey = undefined;
        var updateVal = undefined;

        switch (attributeName)
        {
            case "permission":
            {
                return this.$getDenied();
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

            default:
            {
                if (character && this.$canControlAttribute(character, attributeName))
                {
                    updateObj =
                        findObjs({ type: "attribute", characterid: character.id, name: attributeName })[0] ||
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
            return this.$getDenied();
        }

        updateObj.set(updateKey, updateVal);

        return this.$getAttribute(nameOrId, attributeName, max);
    }
}

class MychScriptVariables
{
    // generic container
}

class MychScriptError
{
    constructor(stage, message, source, offset)
    {
        this.stage = stage;
        this.message = message;
        this.source = source;
        this.offset = offset;
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
    constructor(variables)
    {
        this.type = undefined;
        this.source = undefined;
        this.context = undefined;
        this.definition = {};
        this.variables = variables || {};
        this.nestedScripts = [];
        this.complete = false;
    }

    rethrowExpressionError(stage, exception, expressionOffset, source)
    {
        if (exception instanceof MychExpressionError)
        {
            throw new MychScriptError(stage, exception.message + " in expression", (source || this.source), expressionOffset + exception.offset);
        }

        throw new MychScriptError(stage, exception + " in expression", this.source, expressionOffset);
    }

    rethrowTemplateError(stage, exception, templateOffset)
    {
        if (exception instanceof MychTemplateError)
        {
            throw new MychScriptError(stage, exception.message + " in template", this.source, templateOffset + exception.offset);
        }

        throw new MychScriptError(stage, exception + " in template", this.source, templateOffset);
    }

    static commands =
    {
        script:
        {
            execute: function*()
            {
                var nestedScriptExit = yield* this.executeNestedScripts();
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

            execute: function*()
            {
                if (this.definition.expression)
                {
                    var exitCondition;

                    try
                    {
                        exitCondition = yield* this.definition.expression.evaluate(this.variables, this.context);
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
                var branch = { nestedScriptOffset: 0 };

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

            execute: function*()
            {
                var elseBranch = this.definition.elseBranch;

                for (var branchIndex = 0; branchIndex < this.definition.branches.length; ++branchIndex)
                {
                    var branch = this.definition.branches[branchIndex];
                    var branchScript = (branchIndex == 0 ? this : this.nestedScripts[branch.nestedScriptOffset]);

                    var branchCondition;

                    try
                    {
                        branchCondition = yield* branchScript.definition.expression.evaluate(this.variables, this.context);
                    }
                    catch (exception)
                    {
                        branchScript.rethrowExpressionError("execute", exception, branchScript.definition.expressionOffset);
                    }
    
                    if (MychExpression.coerceBoolean(branchCondition))
                    {
                        var nextBranch = this.definition.branches[branchIndex + 1] || elseBranch || { nestedScriptOffset: this.nestedScripts.length };

                        var branchNestedScriptExit = yield* this.executeNestedScripts(branch.nestedScriptOffset, nextBranch.nestedScriptOffset);
                        return this.propagateExitOnReturn(branchNestedScriptExit);
                    }
                }

                if (elseBranch)
                {
                    var elseNestedScriptExit = yield* this.executeNestedScripts(elseBranch.nestedScriptOffset);
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
                var parentScript = parentScripts[parentScripts.length - 1];

                if (!parentScript || parentScript.type != "if")
                {
                    throw new MychScriptError("parse", "unexpected \"else\" outside of \"if\" block", this.source, 0);
                }

                if (args.expression)
                {
                    var branch = { nestedScriptOffset: parentScript.nestedScripts.length };

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
            
            execute: function*()
            {
                try
                {
                    this.variables[this.definition.variable] = yield* this.definition.expression.evaluate(this.variables, this.context);
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

            execute: function*()
            {
                try
                {
                    yield* this.definition.expression.evaluate(this.variables, this.context);
                }
                catch (exception)
                {
                    this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                }
            },
        },

        chat:
        {
            tokens: [ ":", /(?<template>.+)/ ],

            parse: function(args)
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

                this.complete = true;
            },

            execute: function*()
            {
                var message;

                try
                {
                    message = yield* this.definition.template.evaluate(this.variables, this.context);
                }
                catch (exception)
                {
                    this.rethrowTemplateError("execute", exception, this.definition.templateOffset);
                }

                if (this.variables.chat)
                {
                    this.variables.chat(message);
                }
                else
                {
                    this.context.chat(message);
                }
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

            execute: function*()
            {
                var separator = " ";

                if (this.definition.expression)
                {
                    try
                    {
                        separator = yield* this.definition.expression.evaluate(this.variables, this.context);
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("execute", exception, this.definition.expressionOffset);
                    }
                }

                var combineNestedScriptExit;

                var messages = [];
                var prevChat = this.variables.chat;

                try
                {
                    this.variables.chat = function(message)
                    {
                        messages.push(message);
                    };

                    combineNestedScriptExit = yield* this.executeNestedScripts();
                }
                finally
                {
                    this.variables.chat = prevChat;
                }

                if (this.variables.chat)
                {
                    this.variables.chat(messages.join(separator));
                }
                else
                {
                    this.context.chat(messages.join(separator));
                }

                return this.propagateExitOnReturn(combineNestedScriptExit);
            },
        },
    };

    static parseTokens(tokenPatterns, source, sourceOffset)
    {
        var args = {};

        var whitespaceRegExp = /\s*/g;

        for (var tokenPattern of tokenPatterns)
        {
            whitespaceRegExp.lastIndex = sourceOffset;
            var whitespaceMatch = whitespaceRegExp.exec(source);

            if (!whitespaceMatch || whitespaceMatch.index != sourceOffset)
            {
                return [sourceOffset, undefined];
            }

            sourceOffset = whitespaceMatch.index + whitespaceMatch[0].length;

            var tokenRegExpSource;

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
            
            var tokenRegExp = new RegExp(tokenRegExpSource, "ig");

            tokenRegExp.lastIndex = sourceOffset;
            var tokenMatch = tokenRegExp.exec(source);

            if (!tokenMatch || tokenMatch.index != sourceOffset)
            {
                return [sourceOffset, undefined];
            }

            if (tokenMatch.groups)
            {
                for (var [argName, argValue] of Object.entries(tokenMatch.groups))
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
        var whitespaceMatch = whitespaceRegExp.exec(source);

        if (!whitespaceMatch || whitespaceMatch.index != sourceOffset)
        {
            return [sourceOffset, undefined];
        }

        sourceOffset = whitespaceMatch.index + whitespaceMatch[0].length;

        return [sourceOffset, args];
    }

    static parseCommand(source)
    {
        for (var commandType in MychScript.commands)
        {
            var [sourceOffset, commandTypeArgs] = MychScript.parseTokens([commandType], source, 0);

            if (!commandTypeArgs)
            {
                continue;
            }

            var command = MychScript.commands[commandType];

            if (command.tokens)
            {
                var commandTokensAlternatives = (command.tokens instanceof Array ? [command.tokens] : Object.values(command.tokens));
                var maxSourceOffsetAlternative = sourceOffset;

                for (var commandTokens of commandTokensAlternatives)
                {
                    var [sourceOffsetAlternative, commandArgs] = MychScript.parseTokens(commandTokens, source, sourceOffset);

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

        var [sourceOffset] = MychScript.parseTokens([], source, 0);

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
            var [commandType, commandArgs] = MychScript.parseCommand(source);

            var command = MychScript.commands[commandType];

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
            var nestedScript = this.nestedScripts[this.nestedScripts.length - 1];

            if (nestedScript && !nestedScript.complete)
            {
                return nestedScript.addCommand(source, context, parentScripts.concat(this));
            }

            var [endSourceOffset, endCommandArgs] = MychScript.parseTokens([ "end", /(?<type>\w+)/ ], source, 0);

            if (endCommandArgs)
            {
                if (endSourceOffset != source.length)
                {
                    throw new MychScriptError("parse", "syntax error", source, endSourceOffset);
                }

                if (endCommandArgs.type.value != this.type)
                {
                    var endParentScriptIndex = parentScripts.map(script => script.type).lastIndexOf(endCommandArgs.type.value);

                    if (endParentScriptIndex >= 0)
                    {
                        for (var parentScript of parentScripts.slice(endParentScriptIndex))
                        {
                            parentScript.complete = true;
                        }
                    }

                    throw new MychScriptError("parse", "unexpected block end", source, endCommandArgs.type.offset);
                }

                this.complete = true;

                return this;
            }

            nestedScript = new MychScript(this.variables);
            nestedScript.addCommand(source, context, parentScripts.concat(this));
        
            this.nestedScripts.push(nestedScript);

            return nestedScript;
        }
    }

    *executeNestedScripts(startIndex = undefined, endIndex = undefined)
    {
        for (var nestedScript of this.nestedScripts.slice(startIndex, endIndex))
        {
            var nestedScriptExit = yield* nestedScript.execute();

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

    startExecute()
    {
        var scriptExecuteGenerator = this.execute();
        this.continueExecute(scriptExecuteGenerator, undefined);
    }

    continueExecute(scriptExecuteGenerator, result)
    {
        try
        {
            var scriptExecuteResult = scriptExecuteGenerator.next(result);

            if (scriptExecuteResult.value)
            {
                var nextScriptExecuteContinuation = scriptExecuteResult.value;
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
        var scriptExecuteContinuation = function(script, scriptExecuteGenerator)
        {
            var resultCallback = function(result)
            {
                script.continueExecute(scriptExecuteGenerator, result);
            };

            callbackSetup(resultCallback);
        };

        return scriptExecuteContinuation;
    }
}

class MychTemplateError
{
    constructor(stage, message, source, offset)
    {
        this.stage = stage;
        this.message = message;
        this.source = source;
        this.offset = offset;
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

        if (source != undefined)
        {
            this.parse(source);
        }
    }

    rethrowExpressionError(stage, exception, expressionOffset)
    {
        if (exception instanceof MychExpressionError)
        {
            throw new MychTemplateError(stage, exception.message + " in expression", this.source, expressionOffset + exception.offset);
        }

        throw new MychTemplateError(stage, exception + " in expression", this.source, expressionOffset);
    }

    parse(source)
    {
        var segments = [];
        var segmentRegExp = /(?<string>([^\\$]|\\.|\$(?!\{))+)|\$\{(?<expression>([^}"']|"([^\\"]|\\.)*"|'([^\\']|\\.)*')*)\}/g;
        var segmentMatch;

        var segmentOffset = 0;

        while (segmentMatch = segmentRegExp.exec(source))
        {
            if (segmentMatch.index != segmentOffset)
            {
                throw new MychTemplateError("parse", "syntax error", source, segmentOffset);
            }

            if (segmentMatch.groups.string)
            {
                var unescapedString = segmentMatch.groups.string.replace(/\\(.)/g, "$1");
                segments.push({ type: "string", offset: segmentOffset, value: unescapedString });
            }

            if (segmentMatch.groups.expression)
            {
                var expressionOffset = segmentOffset + "${".length;
                try
                {
                    var expression = new MychExpression(segmentMatch.groups.expression);
                    segments.push({ type: "expression", offset: expressionOffset, expression: expression });
                }
                catch (exception)
                {
                    this.rethrowExpressionError("parse", exception, expressionOffset);
                }
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
        var contextKeys = Object.keys(context).filter(key => !/^\w+$/.test(key));
        var contextKeysRegExp;

        if (contextKeys.length > 0)
        {
            contextKeysRegExp = new RegExp(contextKeys.map(key => key.replace(/(\W)/g, "\\$1").replace(/^\b|\b$/, "\\b")).join("|"), "g");
        }

        var evaluatedSegments = [];

        for (var segment of this.segments)
        {
            switch (segment.type)
            {
                case "string":
                {
                    var evaluatedString = segment.value;

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
                        var expressionValue = yield* segment.expression.evaluate(variables, context);
                        evaluatedSegments.push(MychExpression.coerceMarkup(expressionValue));
                    }
                    catch (exception)
                    {
                        this.rethrowExpressionError("evaluate", exception, segment.offset);
                    }
                }
                break;
            }
        }
    
        return evaluatedSegments.join("");
    }
}

class MychExpressionError
{
    constructor(stage, message, source, offset)
    {
        this.stage = stage;
        this.message = message;
        this.source = source;
        this.offset = offset;
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
                return (string.length > 0);
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
            binary: { precedence: 3, execute: (a,b) => MychExpression.coerceNumber(a) % MychExpression.coerceNumber(b) }
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
        var compareLengthDecreasing = function(string1, string2)
        {
            // Sort in decreasing order of string length.
            return (string2.length - string1.length);
        };

        var createOperatorRegExpSource = function(operator)
        {
            // Escape all characters that might have special meaning and add boundary assertions.
            return operator.replace(/(\W)/g, "\\$1").replace(/^\b|\b$/g, "\\b");
        };

        var operatorRegExpSource = Object.keys(MychExpression.operators).sort(compareLengthDecreasing).map(createOperatorRegExpSource).join("|");

        var tokenPatterns =
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

        var createTokenRegExpSource = function([type, pattern])
        {
            if (pattern instanceof RegExp)
            {
                pattern = pattern.source;
            }

            return "(?<" + type + ">" + pattern + ")";
        };

        return new RegExp(Object.entries(tokenPatterns).map(createTokenRegExpSource).join("|"), "g");
    }

    static tokenRegExp = MychExpression.createTokenRegExp();

    parse(source)
    {
        var tokens = [];
        var tokenMatch;

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

            var [tokenType, tokenValue] = Object.entries(tokenMatch.groups).find(([type, value]) => value);

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
        var valueStack = [];
        var operationStack = [];

        var reduce = function*(precedence)
        {
            while (operationStack.length > 0)
            {
                var operation = operationStack[operationStack.length - 1];

                if (operation.type == "parenthesis")
                {
                    break;
                }

                if (precedence != undefined && operation.precedence > precedence)
                {
                    break;
                }

                operationStack.pop();

                var executionArguments = valueStack.splice(-operation.operands);
                var executionResult;

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
        };

        var expectClosing = [{}];
        var expectTokens = { operator: "unary", literal: "any", identifier: "any", parenthesis: "opening" };

        var getExpectDescription = function()
        {
            return Object.entries(expectTokens).filter(([type, qualifier]) => qualifier).map(([type, qualifier]) => qualifier + " " + type).join(", ");
        };

        for (var token of this.tokens)
        {
            var tokenQualifier = "any";
            var expectTokenQualifiers = [expectTokens[token.type]].flat();

            var operator = undefined;

            switch (token.type)
            {
                case "operator":
                {
                    var operatorVariants = MychExpression.operators[token.value];
                    var operatorType = expectTokenQualifiers.find(qualifier => operatorVariants[qualifier]);
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
                var expectDescription = getExpectDescription();
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
                    var identifierContext = variables;
                    var identifierValue = variables[token.value];

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

                        var openingParenthesisOperation = operationStack.pop();
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
            var expectDescription = getExpectDescription();
            throw new MychExpressionError("evaluate", "expected " + expectDescription, this.source, this.source.length);
        }

        yield* reduce();

        if (operationStack.length != 0)
        {
            var expectDescription = getExpectDescription();
            throw new MychExpressionError("evaluate", "expected " + expectDescription, this.source, this.source.length);
        }

        var result = MychExpression.coerceScalar(valueStack);

        if (result instanceof MychExpressionArgs)
        {
            result = Array.of.apply(null, result);
        }

        return result;
    }
}
