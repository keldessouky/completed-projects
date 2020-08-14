package com.techelevator;

import java.util.List;
import java.util.Map;

import javax.sql.DataSource;

import com.techelevator.model.dao.ReservationDAO;
import com.techelevator.model.dao.SpaceDAO;
import com.techelevator.model.dao.VenueDAO;
import com.techelevator.model.dao.jdbc.JDBCReservationDAO;
import com.techelevator.model.dao.jdbc.JDBCSpaceDAO;
import com.techelevator.model.dao.jdbc.JDBCVenueDAO;
import com.techelevator.model.domain.Reservation;
import com.techelevator.model.domain.Space;
import com.techelevator.model.domain.Venue;

public class Controller {
	private List<Venue> venueList;
	private VenueDAO venueDao;
	private SpaceDAO spaceDao;
	private ReservationDAO reservationDao;

	public Controller(DataSource dataSource) { // exception null is always because there was no object newly
												// instantiated
		venueDao = new JDBCVenueDAO(dataSource);
		spaceDao = new JDBCSpaceDAO(dataSource);
		reservationDao = new JDBCReservationDAO(dataSource);
	}

	public List<Venue> getAllVenues() {
		return venueDao.getAllVenues();
	}

	public Map<Integer, Venue> venueMapper() {
		return venueDao.venueMapper(venueList);
	}

	public Venue getVenueById(int userInput) {
		return venueDao.venueMapper(getAllVenues()).get(userInput);
	}

	public List<String> getCategories(Venue venue) {
		return venueDao.getCategories(venue);

	}

	public List<Space> getSpacesFromVenue(String venueName) {
		return spaceDao.getSpacesFromVenue(venueName);
	}

	public List<Reservation> getReservationAvailability(String venueName, String startDate, int numberOfDays,
			int numberOfAttendees) {
		return reservationDao.getReservationAvailability(venueName, startDate, numberOfDays, numberOfAttendees);
	}

	public List<Space> getSpaceById(long userInput) {

		return spaceDao.getSpaceById(userInput);
	}

	public List<Space> getRateById(long userInput) {
		return spaceDao.getRateById(userInput);
	}

}
