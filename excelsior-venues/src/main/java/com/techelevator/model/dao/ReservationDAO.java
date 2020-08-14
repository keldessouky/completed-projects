package com.techelevator.model.dao;

import java.util.List;

import com.techelevator.model.domain.Reservation;

public interface ReservationDAO {
	
	public List<Reservation> getReservationAvailability(String venueName, String startDate, int numberOfDays, int numberOfAttendees);

}
