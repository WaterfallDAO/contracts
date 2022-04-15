pragma solidity ^0.8.4;
pragma experimental ABIEncoderV2;

import "../interfaces/IDispatcher.sol";

contract AddressListRegistry {
    enum UpdateType {None, AddOnly, RemoveOnly, AddAndRemove}

    event ItemAddedToList(uint256 indexed id, address item);

    event ItemRemovedFromList(uint256 indexed id, address item);

    event ListAttested(uint256 indexed id, string description);

    event ListCreated(
        address indexed creator,
        address indexed owner,
        uint256 id,
        UpdateType updateType
    );

    event ListOwnerSet(uint256 indexed id, address indexed nextOwner);

    event ListUpdateTypeSet(
        uint256 indexed id,
        UpdateType prevUpdateType,
        UpdateType indexed nextUpdateType
    );

    struct ListInfo {
        address owner;
        UpdateType updateType;
        mapping(address => bool) itemToIsInList;
    }

    address private immutable DISPATCHER;

    ListInfo[] private lists;

    modifier onlyListOwner(uint256 _id) {
        require(__isListOwner(msg.sender, _id), "Only callable by list owner");
        _;
    }

    constructor(address _dispatcher) public {
        DISPATCHER = _dispatcher;

        // Create the first list as completely empty and immutable, to protect the default `id`
        lists.push(ListInfo({owner: address(0), updateType: UpdateType.None}));
    }


    function addToList(uint256 _id, address[] calldata _items) external onlyListOwner(_id) {
        UpdateType updateType = getListUpdateType(_id);
        require(
            updateType == UpdateType.AddOnly || updateType == UpdateType.AddAndRemove,
            "addToList: Cannot add to list"
        );

        __addToList(_id, _items);
    }


    function attestLists(uint256[] calldata _ids, string[] calldata _descriptions) external {
        require(_ids.length == _descriptions.length, "attestLists: Unequal arrays");

        for (uint256 i; i < _ids.length; i++) {
            require(
                __isListOwner(msg.sender, _ids[i]),
                "attestLists: Only callable by list owner"
            );

            emit ListAttested(_ids[i], _descriptions[i]);
        }
    }

    function createList(
        address _owner,
        UpdateType _updateType,
        address[] calldata _initialItems
    ) external returns (uint256 id_) {
        id_ = getListCount();

        lists.push(ListInfo({owner: _owner, updateType: _updateType}));

        emit ListCreated(msg.sender, _owner, id_, _updateType);

        __addToList(id_, _initialItems);

        return id_;
    }

    function removeFromList(uint256 _id, address[] calldata _items) external onlyListOwner(_id) {
        UpdateType updateType = getListUpdateType(_id);
        require(
            updateType == UpdateType.RemoveOnly || updateType == UpdateType.AddAndRemove,
            "removeFromList: Cannot remove from list"
        );

        // Silently ignores items that are not in the list
        for (uint256 i; i < _items.length; i++) {
            if (isInList(_id, _items[i])) {
                lists[_id].itemToIsInList[_items[i]] = false;

                emit ItemRemovedFromList(_id, _items[i]);
            }
        }
    }

    function setListOwner(uint256 _id, address _nextOwner) external onlyListOwner(_id) {
        lists[_id].owner = _nextOwner;

        emit ListOwnerSet(_id, _nextOwner);
    }

    function setListUpdateType(uint256 _id, UpdateType _nextUpdateType)
        external
        onlyListOwner(_id)
    {
        UpdateType prevUpdateType = getListUpdateType(_id);
        require(
            _nextUpdateType == UpdateType.None || prevUpdateType == UpdateType.AddAndRemove,
            "setListUpdateType: _nextUpdateType not allowed"
        );

        lists[_id].updateType = _nextUpdateType;

        emit ListUpdateTypeSet(_id, prevUpdateType, _nextUpdateType);
    }

    function __addToList(uint256 _id, address[] memory _items) private {
        for (uint256 i; i < _items.length; i++) {
            if (!isInList(_id, _items[i])) {
                lists[_id].itemToIsInList[_items[i]] = true;

                emit ItemAddedToList(_id, _items[i]);
            }
        }
    }

    function __isListOwner(address _who, uint256 _id) private view returns (bool isListOwner_) {
        address owner = getListOwner(_id);
        return
            _who == owner ||
            (owner == getDispatcher() && _who == IDispatcher(getDispatcher()).getOwner());
    }


    function areAllInList(uint256 _id, address[] memory _items)
        external
        view
        returns (bool areAllInList_)
    {
        for (uint256 i; i < _items.length; i++) {
            if (!isInList(_id, _items[i])) {
                return false;
            }
        }

        return true;
    }

    function areAllNotInList(uint256 _id, address[] memory _items)
        external
        view
        returns (bool areAllNotInList_)
    {
        for (uint256 i; i < _items.length; i++) {
            if (isInList(_id, _items[i])) {
                return false;
            }
        }

        return true;
    }

    function areAllInAllLists(uint256[] memory _ids, address[] memory _items)
        external
        view
        returns (bool areAllInAllLists_)
    {
        for (uint256 i; i < _items.length; i++) {
            if (!isInAllLists(_ids, _items[i])) {
                return false;
            }
        }

        return true;
    }

    function areAllInSomeOfLists(uint256[] memory _ids, address[] memory _items)
        external
        view
        returns (bool areAllInSomeOfLists_)
    {
        for (uint256 i; i < _items.length; i++) {
            if (!isInSomeOfLists(_ids, _items[i])) {
                return false;
            }
        }

        return true;
    }

    function areAllNotInAnyOfLists(uint256[] memory _ids, address[] memory _items)
        external
        view
        returns (bool areAllNotInAnyOfLists_)
    {
        for (uint256 i; i < _items.length; i++) {
            if (isInSomeOfLists(_ids, _items[i])) {
                return false;
            }
        }

        return true;
    }

    function isInAllLists(uint256[] memory _ids, address _item)
        public
        view
        returns (bool isInAllLists_)
    {
        for (uint256 i; i < _ids.length; i++) {
            if (!isInList(_ids[i], _item)) {
                return false;
            }
        }

        return true;
    }

    function isInSomeOfLists(uint256[] memory _ids, address _item)
        public
        view
        returns (bool isInSomeOfLists_)
    {
        for (uint256 i; i < _ids.length; i++) {
            if (isInList(_ids[i], _item)) {
                return true;
            }
        }

        return false;
    }

    function getDispatcher() public view returns (address dispatcher_) {
        return DISPATCHER;
    }

    function getListCount() public view returns (uint256 count_) {
        return lists.length;
    }

    function getListOwner(uint256 _id) public view returns (address owner_) {
        return lists[_id].owner;
    }

    function getListUpdateType(uint256 _id) public view returns (UpdateType updateType_) {
        return lists[_id].updateType;
    }

    function isInList(uint256 _id, address _item) public view returns (bool isInList_) {
        return lists[_id].itemToIsInList[_item];
    }
}
