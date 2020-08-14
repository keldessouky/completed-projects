package com.techelevator.tenmo.dao;

import com.techelevator.tenmo.model.TransferDetailsDTO;
import com.techelevator.tenmo.model.Transfer;
import com.techelevator.tenmo.model.TransferSimpleDetailsDTO;

public interface TransferDAO {

	Transfer insertTransfer(Transfer transfer);

	Transfer findTransferById(int transferId);

	Transfer updateTransfer(Transfer transfer);
	
	TransferSimpleDetailsDTO[] findTransfersContainingUserId(int userId);
	
	TransferSimpleDetailsDTO[] findPendingTransfersByUserId(int userId);
	
	TransferDetailsDTO transferDetails(int transferId);
}
