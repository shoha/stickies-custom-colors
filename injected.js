(() => {
  const DEFAULT_COLOR_INDEX = 2;
  const RANGE_MAX = 10000;
  const RANGE_MIN = 0;
  const ENCODED_PREFIX = "777";

  const setOverrides = () => {
    // Encode and decode z-index and color index into a single integer
    // we can store as the z-index remotely.
    stickies.utils.encodeZ = function (z, colorIndex) {
      const zNum = z * (RANGE_MAX - RANGE_MIN + 1) + colorIndex;
      return parseInt(ENCODED_PREFIX + zNum);
    };

    stickies.utils.decodeZ = function (encodedZ) {
      if (encodedZ.toString().indexOf(ENCODED_PREFIX) != 0) {
        return {
          z: encodedZ,
          colorIndex: DEFAULT_COLOR_INDEX,
        };
      }

      const zWithoutPrefix = parseInt(encodedZ.toString().substr(3));

      return {
        z: Math.ceil(RANGE_MIN + zWithoutPrefix / (RANGE_MAX - RANGE_MIN + 1)),
        colorIndex: Math.ceil(
          RANGE_MIN + (zWithoutPrefix % (RANGE_MAX - RANGE_MIN + 1))
        ),
      };
    };

    // Utilize the encoder/decoder to store arbitrary integer color indexes
    stickies.models.Card.prototype.colorize = function (colorIndex) {
      var options =
        arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

      if (this.findSpecialKeyword()) return;

      const { z: currentZ, colorIndex: currentColorIndex } =
        stickies.utils.decodeZ(this.group().get("z"));

      const newEncodedZ = stickies.utils.encodeZ(currentZ, colorIndex);
      this.group().set("z", newEncodedZ);

      if (colorIndex < 0) {
        colorIndex = DEFAULT_COLOR_INDEX;
      }

      this.set({
        colorIndex: colorIndex,
      });

      this.touch();

      if (!options.shouldBroadcast) return;

      this.sheet().trigger("card:colorized", this, colorIndex);
    };

    stickies.models.Card.prototype.sdpColorIndex = function () {
      return stickies.utils.decodeZ(this.group().get("z")).colorIndex;
    };

    // Override the template to show our new selectors
    Object.defineProperty(stickies.views.Card.prototype, "template", {
      get: () => {
        return () => `
    <div class='header-bar'>
      <span class='delete-btn'>&times;</span>
      <span class='notice' style='display: none'></span>
    </div>
    <div class='content'>
      <div class='viewable'></div>
      <textarea class='editable'></textarea>
    </div>
    <div class='card__footer'>
      <div class='card__authors card__action'></div>
      <div class='card__colors card__action'>
        <span class='color card__color color-0'></span>
        <span class='color card__color color-8'></span>
        <span class='color card__color color-5'></span>
        <span class='color card__color color-7'></span>
        <span class='color card__color color-4'></span>
        <span class='color card__color color-11'></span>
        <span class='color card__color color-3'></span>
        <span class='color card__color color-9'></span>
        <span class='color card__color color-10'></span>
        <span class='color card__color color-2'></span>
        <span class='color card__color color-1'></span>
        <span class='color card__color color-6'></span>
      </div>
      <div class='card__plus-one--button card__plus-one card__action'>
        <div class='card__plus-one-count' title="Change the +1 count for this card">+1</div>
      </div>
      <div class='card__plus-one--static-text card__plus-one tooltip-parent'>
        <div class='card__plus-one-count'></div>
        <div class='tooltip tooltip--right'>
          <div class='tooltip__avatars'></div>
        </div>
      </div>
    </div>
  `;
      },
    });

    // Use our helper to decode extended color indexes to set the class
    stickies.views.Card.prototype.updateColor = function (card, color) {
      this.$el.removeClassMatching(/color-\d+/);
      this.$el.addClass(
        `color-${
          card.sdpColorIndex() != null
            ? card.sdpColorIndex()
            : DEFAULT_COLOR_INDEX
        }`
      );
    };

    // Ensure that we are comparing and persisting decoded and encoded values respectively
    stickies.models.Group.prototype.bringForward = function (options) {
      var maxZ = this.sheet().maxZ();
      const { z: currentZ, colorIndex } = stickies.utils.decodeZ(this.get("z"));

      if (currentZ !== maxZ) {
        this.set("z", stickies.utils.encodeZ(maxZ + 1, colorIndex), options);
      }
    };

    // Use the decoded z-index as the CSS value, not the persisted value
    stickies.views.Group.prototype.updateZ = function (group, z) {
      var zIndex;
      const { z: currentZ } = stickies.utils.decodeZ(z);

      if (this.model.isDragging()) {
        zIndex = stickies.utils.zIndexManager.OBJECT_DRAGGING_Z_INDEX;
      } else if (this.model.isBeingDragged()) {
        zIndex = stickies.utils.zIndexManager.OBJECT_BEING_DRAGGED_Z_INDEX;
      } else if (this.focused) {
        zIndex = stickies.utils.zIndexManager.GROUP_FOCUSED_Z_INDEX;
      } else {
        zIndex = currentZ;
      }

      this.$el.css("z-index", zIndex);
    };

    // Compare the encoded z values, not the persisted value
    stickies.models.Sheet.prototype.maxZ = function () {
      var groups = this.groups();

      if (!groups || !(groups.length > 0)) {
        return 0;
      }

      var maxGroup = groups.max(function (group) {
        return stickies.utils.decodeZ(group.get("z")).z || 0;
      });
      return stickies.utils.decodeZ(maxGroup.get("z")).z || 0;
    };

    // Set z properly when creating a new card
    stickies.models.Sheet.prototype.createGroup = function (
      coords,
      name,
      options = {}
    ) {
      const maxZ = this.maxZ();
      const group = this.newGroupAt(coords, name);
      group.set("z", stickies.utils.encodeZ(maxZ + 1, DEFAULT_COLOR_INDEX));
      this.groups().add(group);

      if (!options.empty) {
        group.createCard();
      }

      return group;
    };

    // Rerender all the cards with the new template
    const sheetView = router.roomView.board.sheetView;
    sheetView._childViews.forEach((groupView) => {
      groupView.cardViews.forEach((cardView) => {
        cardView.render();
      });
    });
  };

  try {
    setOverrides();
  } catch {
    const overridesInterval = setInterval(() => {
      // Block until stickies.io has populated global state
      if (!window.stickies) {
        return;
      }

      try {
        setOverrides();
        clearInterval(overridesInterval);
      } catch {}
    }, 100);
  }
})();
