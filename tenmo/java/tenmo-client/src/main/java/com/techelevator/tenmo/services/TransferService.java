package com.techelevator.tenmo.services;

import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.RestTemplate;

import com.techelevator.tenmo.models.AuthenticatedUser;
import com.techelevator.tenmo.models.TransferDetails;
import com.techelevator.tenmo.models.TransferDTO;
import com.techelevator.tenmo.models.TransferSimpleDetails;

@RestController
public class TransferService {

	private String BASE_URL;
	private RestTemplate restTemplate = new RestTemplate();
	private AuthenticatedUser currentUser;
	private Integer userId;

	public void setCurrentUser(AuthenticatedUser currentUser) {
		this.currentUser = currentUser;
		this.userId = currentUser.getUser().getId();
	}

	public TransferService(String url) {
		this.BASE_URL = url;
	}

	public String postNewTransfer(TransferDTO transfer) {
		String postedTransferResult = null;
		HttpEntity<TransferDTO> entity = getAuthorizedEntity(transfer);
		try {
			postedTransferResult = restTemplate.postForObject(BASE_URL + "/transfers", entity, String.class);
		} catch (RestClientResponseException ex) {
			postedTransferResult = "Invaid User ID";
		}
//		catch (HttpServerErrorException ex) {
//			postedTransferResult = "Invaid User ID";
//		}
		return postedTransferResult;
	}

	private HttpEntity<TransferDTO> getAuthorizedEntity(TransferDTO transfer) {
		HttpHeaders headers = new HttpHeaders();
		headers.setBearerAuth(currentUser.getToken());
		headers.setContentType(MediaType.APPLICATION_JSON);
		return new HttpEntity<>(transfer, headers);
	}
	
	private HttpEntity getAuthorizedEntity() {
		HttpHeaders headers = new HttpHeaders();
		headers.setBearerAuth(currentUser.getToken());
		headers.setContentType(MediaType.APPLICATION_JSON);
		return new HttpEntity<>(headers);
	}

	public TransferSimpleDetails[] getTransfers() {
		TransferSimpleDetails[] arrayOfTransfers = null;
		HttpHeaders headers = new HttpHeaders();
		headers.setBearerAuth(currentUser.getToken());
		HttpEntity entity = new HttpEntity<>(headers);
		try {
			arrayOfTransfers = restTemplate.exchange(BASE_URL + "/users/" + userId + "/transfers", HttpMethod.GET,
					entity, TransferSimpleDetails[].class).getBody();
		} catch (RestClientResponseException ex) {
		}
		return arrayOfTransfers;
	}
	
	public TransferSimpleDetails[] getPendingTransfers() {
		TransferSimpleDetails[] arrayOfTransfers = null;
		HttpHeaders headers = new HttpHeaders();
		headers.setBearerAuth(currentUser.getToken());
		HttpEntity entity = new HttpEntity<>(headers);
		try {
			arrayOfTransfers = restTemplate.exchange(BASE_URL + "/users/" + userId + "/pending", HttpMethod.GET,
					entity, TransferSimpleDetails[].class).getBody();
		} catch (RestClientResponseException ex) {
		}
		return arrayOfTransfers;
	}

	public TransferDetails getTransferDetails(int transferId) {
		TransferDetails details = null;
		HttpHeaders headers = new HttpHeaders();
		headers.setBearerAuth(currentUser.getToken());
		HttpEntity entity = new HttpEntity<>(headers);
		try {
			details = restTemplate
					.exchange(BASE_URL + "/transfers/" + transferId, HttpMethod.GET, entity, TransferDetails.class).getBody();
		} catch (RestClientResponseException ex) {
			System.out.println("Invalid transfer ID");
		}
		return details;
	}

	public String approve(Integer transferId) {
		String message = null;
		HttpEntity entity = getAuthorizedEntity();
		try {
			message = restTemplate.exchange(BASE_URL + "/transfers/" + transferId + "/approve", HttpMethod.PUT,
					entity, String.class).getBody();
		} catch (RestClientResponseException ex) {
		}
		return message;
	}
	
	public String reject(Integer transferId) {
		String message = null;
		HttpEntity entity = getAuthorizedEntity();
		try {
			message = restTemplate.exchange(BASE_URL + "/transfers/" + transferId + "/reject", HttpMethod.PUT,
					entity, String.class).getBody();
		} catch (RestClientResponseException ex) {
		}
		return message;
	}
}
